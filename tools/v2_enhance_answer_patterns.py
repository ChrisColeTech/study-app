#!/usr/bin/env python3
"""
V2 Answer Pattern Enhancement Tool - Phase 2

Enhances answer parsing by adding more flexible patterns to catch edge cases
that the main v2_answer_parser missed. Works with PDF input and classified questions.

Key Features:
- PDF input processing with enhanced fallback patterns
- Works with questions that main parser couldn't extract answers for
- Same edge case handling as V1 but adapted for V2 data structure
- Fuzzy matching and explanation-based inference

Usage:
    python v2_enhance_answer_patterns.py --input path/to/pdf --questions path/to/classified.json --answers path/to/answers.json --output path/to/enhanced.json
"""

import re
import json
import argparse
import logging
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


class V2AnswerEnhancer:
    """Enhance answer parsing with additional patterns for PDF edge cases."""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize V2 answer enhancer with enhanced patterns."""
        self.setup_logging(log_level)
        
        # Enhanced patterns for edge cases
        self.enhanced_patterns = [
            # Pattern for missing period with multiple spaces: "B Create..."
            {
                'name': 'letter_multi_space',
                'pattern': re.compile(r'^([A-E])\s{2,}(.+?)(?=\n\n|$)', re.MULTILINE | re.DOTALL),
                'priority': 4
            },
            # Pattern for letter with various punctuation: "B) Create" or "B: Create"
            {
                'name': 'letter_punct',
                'pattern': re.compile(r'^([A-E])[):\-]\s*(.+?)(?=\n\n|$)', re.MULTILINE | re.DOTALL),
                'priority': 5
            },
            # Pattern for "option B" format: "Option B. Create..."
            {
                'name': 'option_format',
                'pattern': re.compile(r'Option\s+([A-E])\.?\s*(.+?)(?=\n\n|$)', re.MULTILINE | re.DOTALL | re.IGNORECASE),
                'priority': 6
            },
            # Pattern for standalone answer without letter: look for AWS service patterns
            {
                'name': 'service_pattern',
                'pattern': re.compile(r'((?:Create|Use|Configure|Set up|Turn on|Enable|Add|Remove|Deploy|Implement)\s+(?:an?|the)?\s*(?:Amazon\s+)?(?:AWS\s+)?[A-Z][a-zA-Z0-9\s]+(?:S3|EC2|VPC|RDS|Lambda|CloudWatch|IAM|ELB|SQS|SNS|DynamoDB|Kinesis|API Gateway|CloudFormation|Route 53|CloudFront|KMS|Systems Manager)[^.]*\.?)', re.IGNORECASE),
                'priority': 7
            },
            # Pattern for explanation-based extraction: "because", "therefore", "thus"
            {
                'name': 'explanation_clue',
                'pattern': re.compile(r'(?:because|therefore|thus|hence|so)\s+([A-E])\s+(?:is|provides|offers|enables)', re.IGNORECASE),
                'priority': 8
            }
        ]
        
        # AWS service keywords for validation
        self.aws_keywords = [
            'S3', 'EC2', 'VPC', 'RDS', 'Lambda', 'CloudWatch', 'IAM', 'EBS', 'ELB',
            'Auto Scaling', 'CloudFormation', 'Route 53', 'CloudFront', 'SQS', 'SNS',
            'DynamoDB', 'Kinesis', 'API Gateway', 'ElastiCache', 'ECS', 'EKS', 'KMS',
            'Systems Manager', 'CloudTrail', 'Config', 'GuardDuty', 'Macie', 'Inspector'
        ]
        
        self.stats = {
            'original_answers': 0,
            'questions_needing_enhancement': 0,
            'successful_enhancements': 0,
            'enhancement_patterns': {},
            'fuzzy_matches': 0,
            'explanation_inferences': 0,
            'failed_enhancements': 0
        }
    
    def setup_logging(self, level: str):
        """Configure logging."""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"v2_answer_enhancer_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def enhance_answers(self, pdf_path: str, questions_file: str, 
                       answers_file: str, output_file: str) -> Dict:
        """
        Enhance existing answers by trying to extract missing ones.
        
        Args:
            pdf_path: Path to PDF file
            questions_file: Path to classified questions JSON
            answers_file: Path to existing answers JSON
            output_file: Path to save enhanced results
            
        Returns:
            Enhanced answers dictionary
        """
        self.logger.info(f"Enhancing answers from PDF: {pdf_path}")
        self.logger.info(f"Using questions: {questions_file}")
        self.logger.info(f"Using existing answers: {answers_file}")
        
        # Load existing data
        questions_data = self.load_json_file(questions_file)
        answers_data = self.load_json_file(answers_file)
        
        self.stats['original_answers'] = len(answers_data['answers'])
        
        # Extract PDF content
        pdf_content = self.extract_pdf_content(pdf_path)
        self.logger.info(f"Extracted PDF content: {len(pdf_content)} characters")
        
        # Find questions that don't have answers or have low confidence
        questions_needing_help = self.identify_questions_needing_enhancement(
            questions_data['questions'], answers_data['answers']
        )
        
        self.stats['questions_needing_enhancement'] = len(questions_needing_help)
        self.logger.info(f"Found {len(questions_needing_help)} questions needing enhancement")
        
        # Try to enhance answers for those questions
        new_answers = []
        enhanced_answers = []
        
        for question in questions_needing_help:
            try:
                enhanced_answer = self.try_enhanced_extraction(question, pdf_content)
                if enhanced_answer:
                    new_answers.append(enhanced_answer)
                    enhanced_answers.append(enhanced_answer)
                    self.stats['successful_enhancements'] += 1
                else:
                    self.stats['failed_enhancements'] += 1
                    
            except Exception as e:
                self.logger.error(f"Failed to enhance question {question.get('question_id')}: {str(e)}")
                self.stats['failed_enhancements'] += 1
                continue
        
        # Combine original and enhanced answers
        all_answers = answers_data['answers'] + new_answers
        all_answers.sort(key=lambda x: x.get('question_number', 0))
        
        # Update metadata
        enhanced_metadata = answers_data['metadata'].copy()
        enhanced_metadata.update({
            'enhancement_date': datetime.now().isoformat(),
            'enhancement_source_pdf': str(pdf_path),
            'original_answers': self.stats['original_answers'],
            'enhanced_answers': len(new_answers),
            'total_answers': len(all_answers),
            'enhancement_success_rate': self.stats['successful_enhancements'] / self.stats['questions_needing_enhancement'] if self.stats['questions_needing_enhancement'] > 0 else 0,
            'enhancement_patterns': self.stats['enhancement_patterns']
        })
        
        result = {
            'metadata': enhanced_metadata,
            'answers': all_answers,
            'enhancement_report': {
                'original_count': self.stats['original_answers'],
                'questions_needing_enhancement': self.stats['questions_needing_enhancement'],
                'successful_enhancements': self.stats['successful_enhancements'],
                'failed_enhancements': self.stats['failed_enhancements'],
                'enhancement_patterns_used': self.stats['enhancement_patterns'],
                'fuzzy_matches': self.stats['fuzzy_matches'],
                'explanation_inferences': self.stats['explanation_inferences'],
                'final_count': len(all_answers)
            }
        }
        
        # Save enhanced results
        self.save_json_file(result, output_file)
        self.logger.info(f"Enhanced answers saved to: {output_file}")
        
        return result
    
    def load_json_file(self, file_path: str) -> Dict:
        """Load JSON file with error handling."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load JSON file {file_path}: {str(e)}")
            raise
    
    def save_json_file(self, data: Dict, file_path: str):
        """Save JSON file with error handling."""
        try:
            output_path = Path(file_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
        except Exception as e:
            self.logger.error(f"Failed to save JSON file {file_path}: {str(e)}")
            raise
    
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
    
    def identify_questions_needing_enhancement(self, questions: List[Dict], 
                                             answers: List[Dict]) -> List[Dict]:
        """
        Identify questions that need enhancement.
        
        Criteria:
        - No answer extracted at all
        - Low confidence answer (< 0.5)
        - Answer flagged for manual review
        
        Args:
            questions: List of all questions
            answers: List of extracted answers
            
        Returns:
            List of questions needing enhancement
        """
        # Create mapping of question_id to answer
        answer_map = {}
        for answer in answers:
            question_id = answer.get('question_id')
            if question_id:
                answer_map[question_id] = answer
        
        questions_needing_help = []
        
        for question in questions:
            question_id = question.get('question_id')
            answer = answer_map.get(question_id)
            
            # No answer extracted
            if not answer:
                questions_needing_help.append(question)
                continue
            
            # Low confidence answer
            if answer.get('validation_confidence', 1.0) < 0.5:
                questions_needing_help.append(question)
                continue
            
            # Answer flagged for manual review
            if answer.get('requires_manual_review', False):
                questions_needing_help.append(question)
                continue
            
            # No correct answers found
            if not answer.get('correct_answers') or len(answer.get('correct_answers', [])) == 0:
                questions_needing_help.append(question)
                continue
        
        return questions_needing_help
    
    def try_enhanced_extraction(self, question: Dict, pdf_content: str) -> Optional[Dict]:
        """
        Try enhanced patterns on a question that needs improvement.
        
        Args:
            question: Question data
            pdf_content: Full PDF content
            
        Returns:
            Enhanced answer result or None
        """
        question_text = question.get('question_text', '')
        question_options = question.get('options', [])
        question_id = question.get('question_id', '')
        
        # Find the question section in PDF
        question_section = self.find_question_section(question_text, pdf_content)
        if not question_section:
            self.logger.warning(f"Could not find question section for {question_id}")
            return None
        
        # Try enhanced patterns
        enhanced_result = self.try_enhanced_patterns(question_section, question_options)
        if enhanced_result:
            # Track pattern usage
            pattern_name = enhanced_result['extraction_method']
            self.stats['enhancement_patterns'][pattern_name] = self.stats['enhancement_patterns'].get(pattern_name, 0) + 1
            
            # Create full answer result
            return {
                'question_id': question_id,
                'question_number': question.get('question_number', 0),
                'raw_answer_text': enhanced_result['raw_answer_text'],
                'extraction_method': enhanced_result['extraction_method'],
                'correct_answers': enhanced_result['correct_answers'],
                'validation_confidence': enhanced_result['validation_confidence'],
                'mapping_issues': enhanced_result.get('mapping_issues', []),
                'mapping_method': enhanced_result.get('mapping_method', 'enhanced_pattern'),
                'explanation': enhanced_result.get('explanation', ''),
                'keywords': enhanced_result.get('keywords', []),
                'requires_manual_review': enhanced_result.get('validation_confidence', 0.0) < 0.6,
                'enhanced': True
            }
        
        # Try fuzzy matching as last resort
        fuzzy_result = self.try_fuzzy_matching(question_section, question_options)
        if fuzzy_result:
            self.stats['fuzzy_matches'] += 1
            return {
                'question_id': question_id,
                'question_number': question.get('question_number', 0),
                'raw_answer_text': fuzzy_result['raw_answer_text'],
                'extraction_method': 'fuzzy_enhanced',
                'correct_answers': fuzzy_result['correct_answers'],
                'validation_confidence': fuzzy_result['validation_confidence'],
                'mapping_issues': fuzzy_result.get('mapping_issues', []),
                'mapping_method': 'fuzzy_text_match',
                'explanation': fuzzy_result.get('explanation', ''),
                'keywords': fuzzy_result.get('keywords', []),
                'requires_manual_review': True,  # Always flag fuzzy matches
                'enhanced': True
            }
        
        # Try explanation-based inference
        inference_result = self.try_explanation_inference(question_section, question_options)
        if inference_result:
            self.stats['explanation_inferences'] += 1
            return {
                'question_id': question_id,
                'question_number': question.get('question_number', 0),
                'raw_answer_text': inference_result['raw_answer_text'],
                'extraction_method': 'explanation_inference',
                'correct_answers': inference_result['correct_answers'],
                'validation_confidence': inference_result['validation_confidence'],
                'mapping_issues': inference_result.get('mapping_issues', []),
                'mapping_method': 'explanation_inference',
                'explanation': inference_result.get('explanation', ''),
                'keywords': inference_result.get('keywords', []),
                'requires_manual_review': True,  # Always flag inferences
                'enhanced': True
            }
        
        return None
    
    def find_question_section(self, question_text: str, pdf_content: str) -> Optional[str]:
        """Find the section of PDF content that contains this question."""
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
        
        # Extract section from question start to next question or reasonable limit
        next_question = content_lower.find('new question', start_pos + 100)
        if next_question == -1:
            section = pdf_content[start_pos:start_pos + 2000]  # Max 2000 chars
        else:
            section = pdf_content[start_pos:next_question]
        
        return section
    
    def try_enhanced_patterns(self, section: str, options: List) -> Optional[Dict]:
        """Try enhanced patterns on a section."""
        # Clean content
        cleaned_content = self.clean_segment_content(section)
        
        # Skip if content is too short
        if len(cleaned_content) < 50:
            return None
        
        # Try enhanced patterns
        for pattern_info in self.enhanced_patterns:
            pattern = pattern_info['pattern']
            format_name = pattern_info['name']
            
            match = pattern.search(cleaned_content)
            if match:
                # Extract answer text based on pattern type
                if format_name in ['letter_multi_space', 'letter_punct', 'option_format']:
                    if len(match.groups()) >= 2:
                        raw_answer = match.group(1)  # Just the letter
                        answer_text = match.group(2).strip()
                    else:
                        raw_answer = match.group(1).strip()
                        answer_text = ""
                elif format_name == 'explanation_clue':
                    raw_answer = match.group(1).strip()  # The letter
                    answer_text = ""
                elif format_name == 'service_pattern':
                    raw_answer = match.group(1).strip()
                    answer_text = raw_answer
                else:
                    raw_answer = match.group(0).strip()
                    answer_text = raw_answer
                
                # Process the extracted answer
                processed = self.process_enhanced_answer(raw_answer, answer_text, options)
                if processed['correct_answers']:
                    processed.update({
                        'raw_answer_text': raw_answer,
                        'extraction_method': format_name,
                        'explanation': self.extract_explanation(cleaned_content),
                        'keywords': self.extract_keywords(cleaned_content)
                    })
                    return processed
        
        return None
    
    def process_enhanced_answer(self, raw_answer: str, answer_text: str, 
                              options: List) -> Dict:
        """Process enhanced answer extraction."""
        # Try to extract letter first
        letters = re.findall(r'[A-E]', raw_answer.upper())
        
        if letters:
            # Map letters to indices
            indices = []
            for letter in letters:
                index = ord(letter.upper()) - ord('A')
                if index < len(options):
                    indices.append(index)
            
            if indices:
                confidence = 0.7  # Medium confidence for enhanced patterns
                return {
                    'correct_answers': indices,
                    'validation_confidence': confidence,
                    'mapping_issues': ['Enhanced pattern extraction'],
                    'mapping_method': 'enhanced_letter_mapping'
                }
        
        # Fallback: try text matching
        if answer_text:
            best_match_idx = -1
            best_similarity = 0.0
            
            for idx, (letter, option_text) in enumerate(options):
                similarity = SequenceMatcher(None, answer_text.lower(), option_text.lower()).ratio()
                if similarity > best_similarity and similarity > 0.4:
                    best_similarity = similarity
                    best_match_idx = idx
            
            if best_match_idx >= 0:
                return {
                    'correct_answers': [best_match_idx],
                    'validation_confidence': best_similarity * 0.8,  # Reduced confidence
                    'mapping_issues': [f'Text similarity match, confidence: {best_similarity:.3f}'],
                    'mapping_method': 'enhanced_text_match'
                }
        
        return {
            'correct_answers': [],
            'validation_confidence': 0.0,
            'mapping_issues': ['Enhanced pattern failed to extract valid answer'],
            'mapping_method': 'enhanced_failed'
        }
    
    def try_fuzzy_matching(self, section: str, options: List) -> Optional[Dict]:
        """Try fuzzy matching as fallback."""
        # Look for any text that might contain answer information
        lines = section.split('\n')
        
        for line in lines:
            line = line.strip()
            if len(line) < 10:
                continue
            
            # Skip obvious question text and option letters
            if line.startswith(('A.', 'B.', 'C.', 'D.', 'E.')):
                continue
            
            # Try fuzzy matching against all options
            best_matches = []
            
            for idx, (letter, option_text) in enumerate(options):
                similarity = SequenceMatcher(None, line.lower(), option_text.lower()).ratio()
                
                # Also check for keyword matches
                keyword_bonus = self.calculate_keyword_overlap(line, option_text)
                final_similarity = similarity + (keyword_bonus * 0.3)
                
                if final_similarity > 0.3:
                    best_matches.append({
                        'index': idx,
                        'similarity': final_similarity,
                        'line': line
                    })
            
            if best_matches:
                # Sort by similarity and take the best
                best_matches.sort(key=lambda x: x['similarity'], reverse=True)
                best_match = best_matches[0]
                
                if best_match['similarity'] > 0.4:
                    return {
                        'raw_answer_text': best_match['line'],
                        'correct_answers': [best_match['index']],
                        'validation_confidence': best_match['similarity'] * 0.6,  # Lower confidence
                        'mapping_issues': [f'Fuzzy match, similarity: {best_match["similarity"]:.3f}'],
                        'explanation': self.extract_explanation(section),
                        'keywords': self.extract_keywords(section)
                    }
        
        return None
    
    def try_explanation_inference(self, section: str, options: List) -> Optional[Dict]:
        """Try to infer answer from explanation content."""
        explanation = self.extract_explanation(section)
        if not explanation or len(explanation) < 50:
            return None
        
        explanation_lower = explanation.lower()
        
        # Look for AWS service names and features mentioned
        option_scores = []
        
        for idx, (letter, option_text) in enumerate(options):
            score = 0
            option_keywords = self.extract_keywords(option_text)
            
            # Count keyword matches
            for keyword in option_keywords:
                if keyword.lower() in explanation_lower:
                    score += 2
            
            # Check for action words that match option text
            option_words = re.findall(r'\b\w{4,}\b', option_text.lower())
            for word in option_words:
                if word in explanation_lower:
                    score += 1
            
            if score > 0:
                option_scores.append({
                    'index': idx,
                    'score': score,
                    'keywords': option_keywords
                })
        
        if option_scores:
            # Sort by score and take the best
            option_scores.sort(key=lambda x: x['score'], reverse=True)
            best_option = option_scores[0]
            
            # Only return if we have reasonable confidence
            if best_option['score'] >= 2:
                confidence = min(best_option['score'] / 10.0, 0.8)  # Cap at 0.8
                
                return {
                    'raw_answer_text': f"Inferred from explanation (score: {best_option['score']})",
                    'correct_answers': [best_option['index']],
                    'validation_confidence': confidence,
                    'mapping_issues': [f'Explanation inference, keyword matches: {best_option["score"]}'],
                    'explanation': explanation,
                    'keywords': best_option['keywords']
                }
        
        return None
    
    def calculate_keyword_overlap(self, text1: str, text2: str) -> float:
        """Calculate keyword overlap between two texts."""
        text1_lower = text1.lower()
        text2_lower = text2.lower()
        
        overlapping_keywords = 0
        total_keywords = 0
        
        for keyword in self.aws_keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in text2_lower:
                total_keywords += 1
                if keyword_lower in text1_lower:
                    overlapping_keywords += 1
        
        if total_keywords == 0:
            return 0.0
        
        return overlapping_keywords / total_keywords
    
    def extract_explanation(self, section: str) -> str:
        """Extract explanation text from question section."""
        # Look for explanation pattern first
        explanation_pattern = re.compile(r'Explanation:\s*(.*?)(?=NEW QUESTION|\Z)', re.DOTALL | re.IGNORECASE)
        match = explanation_pattern.search(section)
        if match:
            explanation = match.group(1).strip()
            explanation = re.sub(r'\s+', ' ', explanation)
            if len(explanation) > 800:
                explanation = explanation[:800] + '...'
            return explanation
        
        # Fallback: look for explanatory text after potential answer area
        lines = section.split('\n')
        explanation_lines = []
        found_options = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Count option lines
            if re.match(r'^[A-E]\.', line):
                found_options += 1
                continue
            
            # After we've seen options, collect explanation text
            if found_options >= 2 and line and not line.startswith('NEW QUESTION'):
                explanation_lines.append(line)
        
        if explanation_lines:
            explanation = ' '.join(explanation_lines)
            if len(explanation) > 600:
                explanation = explanation[:600] + '...'
            return explanation.strip()
        
        return ""
    
    def extract_keywords(self, text: str) -> List[str]:
        """Extract AWS service keywords from text."""
        if not text:
            return []
        
        found_keywords = []
        text_upper = text.upper()
        
        for keyword in self.aws_keywords:
            if keyword.upper() in text_upper:
                found_keywords.append(keyword)
        
        return found_keywords[:8]  # Limit to 8 keywords
    
    def clean_segment_content(self, content: str) -> str:
        """Clean segment content."""
        content = content.replace('\x00', ' ')
        content = content.replace('\ufeff', '')
        content = content.replace('\r\n', '\n').replace('\r', '\n')
        content = re.sub(r'[ \t]+', ' ', content)
        content = re.sub(r'\n\s*\n', '\n\n', content)
        return content.strip()


def main():
    """Main entry point for V2 answer enhancer."""
    parser = argparse.ArgumentParser(description='Enhance answer parsing with additional patterns for PDFs')
    parser.add_argument('--input', required=True, help='Path to input PDF file')
    parser.add_argument('--questions', required=True, help='Path to classified questions JSON file')
    parser.add_argument('--answers', required=True, help='Path to existing answers JSON file')
    parser.add_argument('--output', required=True, help='Path to save enhanced answers')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    
    args = parser.parse_args()
    
    # Validate input files
    for file_path, name in [(args.input, 'PDF'), (args.questions, 'questions'), (args.answers, 'answers')]:
        if not Path(file_path).exists():
            print(f"Error: {name} file not found: {file_path}")
            sys.exit(1)
    
    try:
        enhancer = V2AnswerEnhancer(log_level=args.log_level)
        result = enhancer.enhance_answers(args.input, args.questions, args.answers, args.output)
        
        # Print summary
        report = result['enhancement_report']
        print(f"\n=== V2 Answer Enhancement Complete ===")
        print(f"PDF: {Path(args.input).name}")
        print(f"Original answers: {report['original_count']}")
        print(f"Questions needing enhancement: {report['questions_needing_enhancement']}")
        print(f"Successfully enhanced: {report['successful_enhancements']}")
        print(f"Failed enhancements: {report['failed_enhancements']}")
        print(f"Final answer count: {report['final_count']}")
        print(f"Fuzzy matches: {report['fuzzy_matches']}")
        print(f"Explanation inferences: {report['explanation_inferences']}")
        
        if report['enhancement_patterns_used']:
            print(f"\nEnhancement patterns used:")
            for pattern, count in report['enhancement_patterns_used'].items():
                print(f"  {pattern}: {count} answers")
        
        print(f"\nOutput saved to: {args.output}")
        
    except Exception as e:
        print(f"Enhancement failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()