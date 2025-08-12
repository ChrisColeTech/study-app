#!/usr/bin/env python3
"""
V2 Answer Parser Tool - Phase 2

Extracts correct answers and explanations from AWS PDF files with multi-format parsing
and critical letter-to-index mapping validation.

Key Features:
- PDF input processing with format detection
- Answer letter extraction with multiple patterns
- Critical letter-to-index mapping with validation
- Fuzzy matching fallback for failed extractions
- Confidence scoring and manual review flagging

Usage:
    python v2_answer_parser.py --input path/to/pdf --questions path/to/classified.json --output data/v2/answers.json
"""

import re
import json
import logging
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import sys
from difflib import SequenceMatcher

try:
    import pdfplumber
except ImportError:
    print("pdfplumber not installed. Run: pip install pdfplumber")
    sys.exit(1)


class V2AnswerParser:
    """Extract and validate answers from PDF files with letter-to-index mapping."""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize V2 answer parser with enhanced patterns and validation."""
        self.setup_logging(log_level)
        
        # Format detection patterns (same as v2_pdf_parser)
        self.format_patterns = {
            'surepassexam': re.compile(r'NEW\s+QUESTION\s+(\d+)\s*-\s*\((?:Exam\s+)?Topic\s+(\d+)\)', re.IGNORECASE),
            'simple_numbered': re.compile(r'NEW\s+QUESTION\s+(\d+)(?!\s*-)', re.IGNORECASE),
            'numbered': re.compile(r'^(\d+)\.\s+(.+?)(?=^\d+\.|$)', re.MULTILINE | re.DOTALL),
            'standard': re.compile(r'Question\s+(?:#)?(\d+)[:,]?\s+Topic\s+(\d+)', re.IGNORECASE),
            'legacy': re.compile(r'Question\s+#(\d+)\s+Topic\s+(\d+)', re.IGNORECASE)
        }
        
        # Answer extraction patterns (multiple formats)
        self.answer_patterns = [
            re.compile(r'Answer:\s*([A-E](?:\s*,\s*[A-E])*)', re.IGNORECASE),
            re.compile(r'Correct\s+Answer:\s*([A-E](?:\s*,\s*[A-E])*)', re.IGNORECASE),
            re.compile(r'Solution:\s*([A-E](?:\s*,\s*[A-E])*)', re.IGNORECASE),
            re.compile(r'([A-E])\s+is\s+correct', re.IGNORECASE),
            re.compile(r'The\s+answer\s+is\s+([A-E])', re.IGNORECASE),
            re.compile(r'Option\s+([A-E])\s+is\s+correct', re.IGNORECASE)
        ]
        
        # Explanation extraction pattern
        self.explanation_pattern = re.compile(r'Explanation:\s*(.*?)(?=NEW QUESTION|\Z)', re.DOTALL | re.IGNORECASE)
        
        # AWS service keywords for validation
        self.aws_keywords = [
            'S3', 'EC2', 'VPC', 'RDS', 'Lambda', 'CloudWatch', 'IAM', 'EBS', 'ELB',
            'Auto Scaling', 'CloudFormation', 'Route 53', 'CloudFront', 'SQS', 'SNS',
            'DynamoDB', 'Kinesis', 'API Gateway', 'ElastiCache', 'ECS', 'EKS', 'KMS',
            'Systems Manager', 'CloudTrail', 'Config', 'GuardDuty', 'Macie', 'Inspector'
        ]
        
        # Statistics tracking
        self.stats = {
            'total_questions': 0,
            'answers_extracted': 0,
            'letter_extraction_success': 0,
            'index_mapping_success': 0,
            'fuzzy_match_fallbacks': 0,
            'manual_review_flagged': 0,
            'confidence_distribution': {'high': 0, 'medium': 0, 'low': 0},
            'extraction_methods': {},
            'validation_failures': [],
            'processing_errors': []
        }
        
        self.detected_format = None
    
    def setup_logging(self, level: str):
        """Configure logging for the parser."""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"v2_answer_parser_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def detect_pdf_format(self, pdf_path: str) -> str:
        """Detect PDF format by analyzing content patterns."""
        self.logger.info(f"Detecting PDF format for: {pdf_path}")
        
        format_scores = {'surepassexam': 0, 'simple_numbered': 0, 'numbered': 0, 'standard': 0, 'legacy': 0}
        pages_to_sample = min(10, 5)
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                pages_to_check = min(pages_to_sample, len(pdf.pages))
                
                for i in range(pages_to_check):
                    try:
                        text = pdf.pages[i].extract_text()
                        if not text:
                            continue
                        
                        # Test each format pattern
                        for format_name, pattern in self.format_patterns.items():
                            matches = pattern.findall(text)
                            format_scores[format_name] += len(matches)
                            
                    except Exception as e:
                        self.logger.warning(f"Failed to process page {i}: {str(e)}")
                        continue
        
        except Exception as e:
            self.logger.error(f"Failed to open PDF: {str(e)}")
            return 'standard'  # Fallback format
        
        # Determine best format
        if max(format_scores.values()) == 0:
            detected_format = 'standard'
        else:
            detected_format = max(format_scores, key=format_scores.get)
        
        self.logger.info(f"Format detection scores: {format_scores}")
        self.logger.info(f"Detected format: {detected_format}")
        
        self.detected_format = detected_format
        return detected_format
    
    def parse_answers(self, pdf_path: str, questions_file: str) -> Dict:
        """
        Parse answers from PDF file using classified questions as input.
        
        Args:
            pdf_path: Path to the PDF file
            questions_file: Path to classified questions JSON file
            
        Returns:
            Dict containing metadata and extracted answers with validation
        """
        self.logger.info(f"Starting answer parsing from PDF: {pdf_path}")
        self.logger.info(f"Using questions from: {questions_file}")
        
        # Load classified questions
        try:
            with open(questions_file, 'r', encoding='utf-8') as f:
                questions_data = json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to read questions file: {str(e)}")
            raise
        
        # Detect PDF format
        detected_format = self.detect_pdf_format(pdf_path)
        
        # Extract PDF text content
        pdf_content = self.extract_pdf_content(pdf_path)
        self.logger.info(f"Extracted PDF content: {len(pdf_content)} characters")
        
        # Parse answers for each question
        questions = questions_data['questions']
        self.stats['total_questions'] = len(questions)
        
        parsed_answers = []
        manual_review_items = []
        
        for i, question in enumerate(questions):
            try:
                answer_result = self.parse_question_answer(question, pdf_content)
                if answer_result:
                    parsed_answers.append(answer_result)
                    self.stats['answers_extracted'] += 1
                    
                    # Track confidence distribution
                    confidence = answer_result.get('validation_confidence', 0.0)
                    if confidence >= 0.8:
                        self.stats['confidence_distribution']['high'] += 1
                    elif confidence >= 0.5:
                        self.stats['confidence_distribution']['medium'] += 1
                    else:
                        self.stats['confidence_distribution']['low'] += 1
                    
                    # Flag for manual review if needed
                    if self.flag_for_manual_review(answer_result):
                        manual_review_items.append(self.create_manual_review_item(question, answer_result))
                        self.stats['manual_review_flagged'] += 1
                
                if (i + 1) % 20 == 0:
                    self.logger.info(f"Processed {i + 1}/{len(questions)} questions")
                    
            except Exception as e:
                self.logger.error(f"Failed to parse answer for question {question.get('question_id', 'unknown')}: {str(e)}")
                self.stats['processing_errors'].append({
                    'question_id': question.get('question_id', 'unknown'),
                    'error': str(e)
                })
                continue
        
        self.logger.info(f"Parsing complete. Extracted {len(parsed_answers)} answers from {len(questions)} questions")
        
        return self.create_output(parsed_answers, manual_review_items, pdf_path, questions_file)
    
    def extract_pdf_content(self, pdf_path: str) -> str:
        """Extract all text content from PDF."""
        content = ""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    try:
                        page_text = page.extract_text()
                        if page_text:
                            content += page_text + "\n\n"
                    except Exception as e:
                        self.logger.warning(f"Failed to extract text from page: {str(e)}")
                        continue
        except Exception as e:
            self.logger.error(f"Failed to extract PDF content: {str(e)}")
            raise
        
        return content
    
    def parse_question_answer(self, question: Dict, pdf_content: str) -> Optional[Dict]:
        """
        Parse answer for a single question with validation.
        
        Args:
            question: Question data from classified questions
            pdf_content: Full PDF text content
            
        Returns:
            Parsed answer with validation data or None
        """
        question_text = question.get('question_text', '')
        question_options = question.get('options', [])
        question_id = question.get('question_id', '')
        
        # Find the question section in PDF content
        question_section = self.find_question_section(question_text, pdf_content)
        if not question_section:
            self.logger.warning(f"Could not find question section for {question_id}")
            return None
        
        # Extract answer using multiple patterns
        extracted_answer = self.extract_answer_multiple_patterns(question_section)
        if not extracted_answer:
            return None
        
        # Process extracted answer with letter-to-index mapping
        answer_result = self.process_extracted_answer(
            extracted_answer['answer_text'], 
            question_options,
            extracted_answer.get('extraction_method', 'unknown')
        )
        
        # Extract explanation
        explanation = self.extract_explanation(question_section)
        
        # Enhanced result with validation data
        result = {
            'question_id': question_id,
            'question_number': question.get('question_number', 0),
            'raw_answer_text': extracted_answer['answer_text'],
            'extraction_method': extracted_answer['extraction_method'],
            'correct_answers': answer_result['correct_answers'],
            'validation_confidence': answer_result['validation_confidence'],
            'mapping_issues': answer_result['mapping_issues'],
            'mapping_method': answer_result['mapping_method'],
            'explanation': explanation,
            'keywords': self.extract_keywords(explanation),
            'requires_manual_review': self.flag_for_manual_review(answer_result)
        }
        
        # Update method statistics
        method = extracted_answer['extraction_method']
        self.stats['extraction_methods'][method] = self.stats['extraction_methods'].get(method, 0) + 1
        
        return result
    
    def find_question_section(self, question_text: str, pdf_content: str) -> Optional[str]:
        """
        Find the section of PDF content that contains this question.
        
        Args:
            question_text: Question text to search for
            pdf_content: Full PDF content
            
        Returns:
            Section of content containing the question and its answer
        """
        # Clean question text for matching
        question_clean = re.sub(r'\s+', ' ', question_text).strip()
        
        # Try to find question by matching first 50 characters
        question_start = question_clean[:50]
        
        # Look for the question in PDF content
        content_lower = pdf_content.lower()
        question_lower = question_start.lower()
        
        start_pos = content_lower.find(question_lower)
        if start_pos == -1:
            # Try fuzzy matching with shorter segments
            for i in range(30, 20, -5):
                short_question = question_clean[:i]
                if short_question.lower() in content_lower:
                    start_pos = content_lower.find(short_question.lower())
                    break
        
        if start_pos == -1:
            return None
        
        # Extract section from question start to next question or end
        if self.detected_format == 'surepassexam':
            # Look for next "NEW QUESTION" or end
            next_question = content_lower.find('new question', start_pos + 100)
            if next_question == -1:
                section = pdf_content[start_pos:start_pos + 2000]  # Max 2000 chars
            else:
                section = pdf_content[start_pos:next_question]
        else:
            # For other formats, extract reasonable section
            section = pdf_content[start_pos:start_pos + 1500]  # Max 1500 chars
        
        return section
    
    def extract_answer_multiple_patterns(self, section: str) -> Optional[Dict]:
        """
        Extract answer using multiple patterns with fallback.
        
        Args:
            section: Text section containing question and answer
            
        Returns:
            Dict with answer_text and extraction_method
        """
        for i, pattern in enumerate(self.answer_patterns):
            match = pattern.search(section)
            if match:
                answer_letters = match.group(1)
                self.stats['letter_extraction_success'] += 1
                
                return {
                    'answer_text': answer_letters,
                    'extraction_method': f'pattern_{i+1}'
                }
        
        # No pattern matched
        return None
    
    def process_extracted_answer(self, answer_text: str, question_options: List, method: str) -> Dict:
        """
        Convert extracted answer to validated option indices.
        
        This is the critical letter-to-index mapping with validation.
        
        Args:
            answer_text: Extracted answer text (e.g., "A, C")
            question_options: List of question options [[letter, text], ...]
            method: Extraction method used
            
        Returns:
            Dict with correct_answers indices and validation data
        """
        # Step 1: Extract answer letters
        letters = self.extract_answer_letters(answer_text)
        
        if not letters:
            # Fallback to fuzzy matching
            return self.fuzzy_match_answer_text(answer_text, question_options)
        
        # Step 2: Map letters to indices
        indices = []
        for letter in letters:
            index = ord(letter.upper()) - ord('A')
            indices.append(index)
        
        # Step 3: Validate mapping
        validation = self.validate_answer_mapping(indices, question_options, answer_text)
        
        # Track statistics
        if validation['validation_method'] == 'letter_mapping':
            self.stats['index_mapping_success'] += 1
        
        return {
            'correct_answers': indices,
            'validation_confidence': validation['confidence'],
            'mapping_issues': validation['issues'],
            'mapping_method': validation['validation_method']
        }
    
    def extract_answer_letters(self, answer_text: str) -> List[str]:
        """Extract answer letters with multiple pattern fallback."""
        # Primary pattern: direct letter extraction
        letters = re.findall(r'[A-E]', answer_text.upper())
        
        if letters:
            # Remove duplicates while preserving order
            seen = set()
            unique_letters = []
            for letter in letters:
                if letter not in seen:
                    unique_letters.append(letter)
                    seen.add(letter)
            return unique_letters
        
        return []  # No letters found
    
    def validate_answer_mapping(self, indices: List[int], options: List, raw_answer: str) -> Dict:
        """
        Validate that extracted indices match actual answer content.
        
        Args:
            indices: List of option indices
            options: Question options [[letter, text], ...]
            raw_answer: Raw answer text
            
        Returns:
            Validation result with confidence and issues
        """
        issues = []
        confidence = 1.0
        
        # Check index bounds
        for idx in indices:
            if idx >= len(options):
                issues.append(f"Index {idx} exceeds option count {len(options)}")
                confidence *= 0.3
        
        # Text similarity validation if we have valid indices
        valid_indices = [idx for idx in indices if idx < len(options)]
        if valid_indices:
            selected_options = [options[i][1] for i in valid_indices]
            similarity = self.calculate_text_similarity(raw_answer, selected_options)
            confidence *= similarity
            
            if similarity < 0.5:
                issues.append("Low similarity between extracted answer and selected options")
        
        return {
            'confidence': confidence,
            'issues': issues,
            'validation_method': 'letter_mapping' if indices else 'failed_extraction'
        }
    
    def calculate_text_similarity(self, raw_answer: str, selected_options: List[str]) -> float:
        """Calculate similarity between raw answer and selected options."""
        if not selected_options:
            return 0.0
        
        # Use keyword-based similarity for AWS questions
        raw_answer_lower = raw_answer.lower()
        total_similarity = 0.0
        
        for option_text in selected_options:
            option_lower = option_text.lower()
            
            # Check for AWS service keyword matches
            keyword_matches = 0
            total_keywords = 0
            
            for keyword in self.aws_keywords:
                keyword_lower = keyword.lower()
                if keyword_lower in option_lower:
                    total_keywords += 1
                    if keyword_lower in raw_answer_lower:
                        keyword_matches += 1
            
            # Calculate keyword-based similarity
            if total_keywords > 0:
                keyword_similarity = keyword_matches / total_keywords
            else:
                # Fallback to basic text similarity
                keyword_similarity = SequenceMatcher(None, raw_answer_lower, option_lower).ratio()
            
            total_similarity += keyword_similarity
        
        return total_similarity / len(selected_options)
    
    def fuzzy_match_answer_text(self, answer_text: str, options: List) -> Dict:
        """
        When letter extraction fails, match answer text directly to options.
        
        Args:
            answer_text: Raw answer text
            options: Question options
            
        Returns:
            Fuzzy matching result
        """
        best_matches = []
        
        for idx, (letter, option_text) in enumerate(options):
            # Calculate similarity between answer text and option text
            similarity = SequenceMatcher(None, answer_text.lower(), option_text.lower()).ratio()
            
            # Also check for AWS keyword matches
            keyword_bonus = self.calculate_keyword_overlap(answer_text, option_text)
            final_similarity = similarity + (keyword_bonus * 0.2)  # Bonus for keyword matches
            
            if final_similarity > 0.4:  # Lower threshold for fuzzy matching
                best_matches.append({
                    'index': idx,
                    'similarity': final_similarity,
                    'option_text': option_text
                })
        
        # Sort by similarity, return best match(es)
        best_matches.sort(key=lambda x: x['similarity'], reverse=True)
        
        if best_matches:
            self.stats['fuzzy_match_fallbacks'] += 1
            return {
                'correct_answers': [best_matches[0]['index']],  # Just the best match
                'validation_confidence': best_matches[0]['similarity'],
                'mapping_issues': [f"Used fuzzy matching, confidence: {best_matches[0]['similarity']:.3f}"],
                'mapping_method': 'fuzzy_text_match'
            }
        
        return {
            'correct_answers': [],
            'validation_confidence': 0.0,
            'mapping_issues': ['No fuzzy match found'],
            'mapping_method': 'no_match_found'
        }
    
    def calculate_keyword_overlap(self, text1: str, text2: str) -> float:
        """Calculate keyword overlap between two texts."""
        text1_lower = text1.lower()
        text2_lower = text2.lower()
        
        overlapping_keywords = 0
        total_keywords = 0
        
        for keyword in self.aws_keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in text2_lower:  # Option contains keyword
                total_keywords += 1
                if keyword_lower in text1_lower:  # Answer also contains keyword
                    overlapping_keywords += 1
        
        if total_keywords == 0:
            return 0.0
        
        return overlapping_keywords / total_keywords
    
    def extract_explanation(self, section: str) -> str:
        """Extract explanation text from question section."""
        # Look for explanation pattern
        match = self.explanation_pattern.search(section)
        if match:
            explanation = match.group(1).strip()
            # Clean up explanation
            explanation = re.sub(r'\s+', ' ', explanation)
            # Limit length
            if len(explanation) > 1000:
                explanation = explanation[:1000] + '...'
            return explanation
        
        # Fallback: look for text after answer
        # This is format-specific logic
        lines = section.split('\n')
        explanation_lines = []
        found_answer = False
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Look for answer indicators
            if re.match(r'Answer:\s*[A-E]', line, re.IGNORECASE):
                found_answer = True
                continue
            
            # Collect lines after answer
            if found_answer and line and not line.startswith('NEW QUESTION'):
                explanation_lines.append(line)
                
            # Stop at next question
            if 'NEW QUESTION' in line.upper():
                break
        
        explanation = ' '.join(explanation_lines)
        if len(explanation) > 800:
            explanation = explanation[:800] + '...'
        
        return explanation.strip()
    
    def extract_keywords(self, explanation: str) -> List[str]:
        """Extract AWS service keywords from explanation."""
        if not explanation:
            return []
        
        found_keywords = []
        explanation_upper = explanation.upper()
        
        for keyword in self.aws_keywords:
            if keyword.upper() in explanation_upper:
                found_keywords.append(keyword)
        
        return found_keywords[:10]  # Limit to 10 keywords
    
    def flag_for_manual_review(self, answer_result: Dict, threshold: float = 0.7) -> bool:
        """Flag low-confidence answers for manual review."""
        review_triggers = [
            answer_result.get('validation_confidence', 0.0) < threshold,
            len(answer_result.get('mapping_issues', [])) > 0,
            answer_result.get('mapping_method') in ['fuzzy_text_match', 'no_match_found'],
            len(answer_result.get('correct_answers', [])) == 0
        ]
        
        return any(review_triggers)
    
    def create_manual_review_item(self, question: Dict, answer_result: Dict) -> Dict:
        """Create structured item for manual review queue."""
        return {
            'question_id': question.get('question_id', 'unknown'),
            'question_text': question.get('question_text', '')[:100] + '...',
            'extracted_answer_text': answer_result.get('raw_answer_text', ''),
            'options': question.get('options', []),
            'proposed_indices': answer_result.get('correct_answers', []),
            'confidence': answer_result.get('validation_confidence', 0.0),
            'issues': answer_result.get('mapping_issues', []),
            'mapping_method': answer_result.get('mapping_method', 'unknown'),
            'requires_human_validation': True
        }
    
    def create_output(self, answers: List[Dict], manual_review_items: List[Dict], 
                     pdf_path: str, questions_file: str) -> Dict:
        """Create final output structure with comprehensive metadata."""
        # Calculate success rate
        success_rate = self.stats['answers_extracted'] / self.stats['total_questions'] if self.stats['total_questions'] > 0 else 0
        
        # Calculate average confidence
        confidences = [a.get('validation_confidence', 0.0) for a in answers]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        # Letter extraction success rate
        letter_success_rate = self.stats['letter_extraction_success'] / self.stats['total_questions'] if self.stats['total_questions'] > 0 else 0
        
        # Index mapping success rate
        index_success_rate = self.stats['index_mapping_success'] / self.stats['answers_extracted'] if self.stats['answers_extracted'] > 0 else 0
        
        return {
            'metadata': {
                'parsing_date': datetime.now().isoformat(),
                'source_pdf': str(pdf_path),
                'source_questions': str(questions_file),
                'detected_format': self.detected_format,
                'total_questions': self.stats['total_questions'],
                'answers_extracted': self.stats['answers_extracted'],
                'extraction_success_rate': round(success_rate, 3),
                'letter_extraction_success_rate': round(letter_success_rate, 3),
                'index_mapping_success_rate': round(index_success_rate, 3),
                'average_confidence': round(avg_confidence, 3),
                'fuzzy_match_fallbacks': self.stats['fuzzy_match_fallbacks'],
                'manual_review_flagged': self.stats['manual_review_flagged'],
                'confidence_distribution': self.stats['confidence_distribution'],
                'extraction_methods': self.stats['extraction_methods']
            },
            'answers': answers,
            'manual_review_queue': manual_review_items,
            'processing_report': {
                'success_rates': {
                    'extraction': round(success_rate, 3),
                    'letter_extraction': round(letter_success_rate, 3),
                    'index_mapping': round(index_success_rate, 3)
                },
                'validation_failures': self.stats['validation_failures'],
                'processing_errors': self.stats['processing_errors'],
                'method_distribution': self.stats['extraction_methods'],
                'requires_manual_review': len(manual_review_items)
            }
        }


def main():
    """Main entry point for V2 answer parser."""
    parser = argparse.ArgumentParser(description='Extract and validate answers from AWS PDF files')
    parser.add_argument('--input', required=True, help='Path to input PDF file')
    parser.add_argument('--questions', required=True, help='Path to classified questions JSON file')
    parser.add_argument('--output', required=True, help='Path to output JSON file')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    
    args = parser.parse_args()
    
    # Validate input files
    if not Path(args.input).exists():
        print(f"Error: Input PDF file not found: {args.input}")
        sys.exit(1)
        
    if not Path(args.questions).exists():
        print(f"Error: Questions file not found: {args.questions}")
        sys.exit(1)
    
    # Create output directory if needed
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Run parsing
    answer_parser = V2AnswerParser(log_level=args.log_level)
    
    try:
        result = answer_parser.parse_answers(args.input, args.questions)
        
        # Save results
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        # Print summary
        metadata = result['metadata']
        print(f"\n=== V2 Answer Parsing Complete ===")
        print(f"PDF: {Path(args.input).name}")
        print(f"Questions processed: {metadata['total_questions']}")
        print(f"Answers extracted: {metadata['answers_extracted']}")
        print(f"Extraction success rate: {metadata['extraction_success_rate']:.1%}")
        print(f"Letter extraction rate: {metadata['letter_extraction_success_rate']:.1%}")
        print(f"Index mapping success rate: {metadata['index_mapping_success_rate']:.1%}")
        print(f"Average confidence: {metadata['average_confidence']:.3f}")
        print(f"Fuzzy match fallbacks: {metadata['fuzzy_match_fallbacks']}")
        print(f"Manual review flagged: {metadata['manual_review_flagged']}")
        
        print(f"\nConfidence distribution:")
        for level, count in metadata['confidence_distribution'].items():
            print(f"  {level}: {count} answers")
        
        if metadata['extraction_methods']:
            print(f"\nExtraction methods used:")
            for method, count in metadata['extraction_methods'].items():
                print(f"  {method}: {count} answers")
        
        print(f"\nOutput saved to: {output_path}")
        
    except Exception as e:
        print(f"Error during parsing: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()