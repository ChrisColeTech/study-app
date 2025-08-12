#!/usr/bin/env python3
"""
V2 PDF Parser Tool for Multi-Format Study App

Enhanced parser that automatically detects and handles different PDF question formats:
- SurePassExam: NEW QUESTION (\d+) - \((?:Exam\s+)?Topic (\d+)\)
- Numbered: ^(\d+)\.\s+(.*?)(?=^\d+\.|$)
- Standard: Question\s+(\d+)[:,]?\s*(.*?)

Usage:
    python v2_pdf_parser.py --input path/to/pdf --output path/to/output.json
"""

import re
import json
import logging
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import sys

try:
    import pdfplumber
except ImportError:
    print("pdfplumber not installed. Run: pip install pdfplumber")
    sys.exit(1)


class V2PDFParser:
    """Enhanced PDF parser with automatic format detection."""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize V2 PDF parser with logging."""
        self.setup_logging(log_level)
        
        # Format detection patterns
        self.format_patterns = {
            'surepassexam': re.compile(r'NEW\s+QUESTION\s+(\d+)\s*-\s*\((?:Exam\s+)?Topic\s+(\d+)\)', re.IGNORECASE),
            'simple_numbered': re.compile(r'NEW\s+QUESTION\s+(\d+)(?!\s*-)', re.IGNORECASE),  # NEW QUESTION X (without Topic)
            'numbered': re.compile(r'^(\d+)\.\s+(.+?)(?=^\d+\.|$)', re.MULTILINE | re.DOTALL),
            'standard': re.compile(r'Question\s+(?:#)?(\d+)[:,]?\s+Topic\s+(\d+)', re.IGNORECASE),
            'legacy': re.compile(r'Question\s+#(\d+)\s+Topic\s+(\d+)', re.IGNORECASE)
        }
        
        self.answer_pattern = re.compile(r'^([A-E])\.\s+(.+?)(?=^[A-E]\.|$)', re.MULTILINE | re.DOTALL)
        
        self.detected_format = None
        self.stats = {
            'total_pages': 0,
            'processed_pages': 0,
            'questions_found': 0,
            'failed_pages': [],
            'extraction_errors': [],
            'format_detection_attempts': []
        }
    
    def setup_logging(self, level: str):
        """Configure logging for the parser."""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"v2_pdf_parser_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def detect_pdf_format(self, pdf_path: str) -> str:
        """
        Analyze PDF to detect question format.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Format type: 'surepassexam', 'numbered', 'standard', or 'legacy'
        """
        self.logger.info(f"Detecting PDF format for: {pdf_path}")
        
        format_scores = {'surepassexam': 0, 'simple_numbered': 0, 'numbered': 0, 'standard': 0, 'legacy': 0}
        pages_to_sample = min(10, 5)  # Sample first 10 pages or first 5 pages
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                # Sample pages for format detection
                pages_to_check = min(pages_to_sample, len(pdf.pages))
                
                for i in range(pages_to_check):
                    try:
                        text = pdf.pages[i].extract_text()
                        if not text:
                            continue
                        
                        # Test each format pattern
                        for format_name, pattern in self.format_patterns.items():
                            matches = pattern.findall(text)
                            if matches:
                                format_scores[format_name] += len(matches)
                                self.logger.debug(f"Page {i+1}: Found {len(matches)} {format_name} matches")
                                
                    except Exception as e:
                        self.logger.warning(f"Error processing page {i+1} for format detection: {str(e)}")
                        continue
        
        except Exception as e:
            self.logger.error(f"Failed to open PDF for format detection: {str(e)}")
            # Default to legacy format if detection fails
            return 'legacy'
        
        # Determine format based on scores
        detected_format = max(format_scores, key=format_scores.get)
        max_score = format_scores[detected_format]
        
        self.stats['format_detection_attempts'] = format_scores
        
        if max_score == 0:
            self.logger.warning("No format patterns detected, defaulting to legacy format")
            detected_format = 'legacy'
        
        self.logger.info(f"Detected PDF format: {detected_format} (score: {max_score})")
        self.detected_format = detected_format
        
        return detected_format
    
    def extract_questions(self, pdf_path: str) -> Dict:
        """
        Extract all questions from PDF file using detected format.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Dict containing metadata and extracted questions
        """
        self.logger.info(f"Starting V2 PDF extraction from: {pdf_path}")
        
        # Detect format first
        pdf_format = self.detect_pdf_format(pdf_path)
        
        questions = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                self.stats['total_pages'] = len(pdf.pages)
                self.logger.info(f"PDF has {self.stats['total_pages']} pages, using {pdf_format} format")
                
                for page_num, page in enumerate(pdf.pages, 1):
                    try:
                        if pdf_format == 'surepassexam':
                            page_questions = self.process_surepassexam_page(page, page_num)
                        elif pdf_format == 'simple_numbered':
                            page_questions = self.process_simple_numbered_page(page, page_num)
                        elif pdf_format == 'numbered':
                            page_questions = self.process_numbered_page(page, page_num)
                        elif pdf_format == 'standard':
                            page_questions = self.process_standard_page(page, page_num)
                        else:  # legacy
                            page_questions = self.process_legacy_page(page, page_num)
                        
                        questions.extend(page_questions)
                        self.stats['processed_pages'] += 1
                        
                        if page_num % 50 == 0:
                            self.logger.info(f"Processed {page_num} pages, found {len(questions)} questions")
                            
                    except Exception as e:
                        self.logger.error(f"Failed to process page {page_num}: {str(e)}")
                        self.stats['failed_pages'].append(page_num)
                        self.stats['extraction_errors'].append(f"Page {page_num}: {str(e)}")
                        continue
        
        except Exception as e:
            self.logger.error(f"Failed to open PDF: {str(e)}")
            raise
        
        self.stats['questions_found'] = len(questions)
        self.logger.info(f"Extraction complete. Found {len(questions)} questions using {pdf_format} format")
        
        return self.create_output(questions, pdf_format)
    
    def process_surepassexam_page(self, page, page_num: int) -> List[Dict]:
        """Process page using SurePassExam format."""
        questions = []
        
        try:
            text = page.extract_text()
            if not text or len(text.strip()) < 50:
                return questions
            
            # Pattern: NEW QUESTION (\d+) - \((?:Exam\s+)?Topic (\d+)\)
            question_matches = list(self.format_patterns['surepassexam'].finditer(text))
            
            for i, match in enumerate(question_matches):
                try:
                    start_pos = match.start()
                    if i + 1 < len(question_matches):
                        end_pos = question_matches[i + 1].start()
                    else:
                        end_pos = len(text)
                    
                    question_text = text[start_pos:end_pos].strip()
                    question_dict = self.parse_surepassexam_content(
                        question_text,
                        int(match.group(2)),  # topic number
                        int(match.group(1)),  # question number
                        page_num
                    )
                    
                    if question_dict:
                        questions.append(question_dict)
                        
                except Exception as e:
                    self.logger.warning(f"Failed to parse SurePassExam question on page {page_num}: {str(e)}")
                    continue
                    
        except Exception as e:
            self.logger.error(f"Text extraction failed for SurePassExam page {page_num}: {str(e)}")
            raise
        
        return questions
    
    def process_simple_numbered_page(self, page, page_num: int) -> List[Dict]:
        """Process page using simple numbered format (NEW QUESTION X without Topic)."""
        questions = []
        
        try:
            text = page.extract_text()
            if not text or len(text.strip()) < 50:
                return questions
            
            # Pattern: NEW QUESTION (\d+) (without Topic part)
            question_matches = list(self.format_patterns['simple_numbered'].finditer(text))
            
            for i, match in enumerate(question_matches):
                try:
                    start_pos = match.start()
                    if i + 1 < len(question_matches):
                        end_pos = question_matches[i + 1].start()
                    else:
                        end_pos = len(text)
                    
                    question_text = text[start_pos:end_pos].strip()
                    question_dict = self.parse_simple_numbered_content(
                        question_text,
                        1,  # default topic - will be reclassified
                        int(match.group(1)),  # question number
                        page_num
                    )
                    
                    if question_dict:
                        questions.append(question_dict)
                        
                except Exception as e:
                    self.logger.warning(f"Failed to parse simple numbered question on page {page_num}: {str(e)}")
                    continue
                    
        except Exception as e:
            self.logger.error(f"Text extraction failed for simple numbered page {page_num}: {str(e)}")
            raise
        
        return questions
    
    def process_numbered_page(self, page, page_num: int) -> List[Dict]:
        """Process page using numbered format."""
        questions = []
        
        try:
            text = page.extract_text()
            if not text or len(text.strip()) < 50:
                return questions
            
            # Pattern: ^(\d+)\.\s+(.*?)(?=^\d+\.|$)
            question_matches = list(self.format_patterns['numbered'].finditer(text))
            
            for match in question_matches:
                try:
                    question_num = int(match.group(1))
                    question_content = match.group(2).strip()
                    
                    # For numbered format, we'll assign topic 1 by default
                    # This can be reclassified later by the classifier
                    question_dict = self.parse_numbered_content(
                        question_content,
                        1,  # default topic
                        question_num,
                        page_num
                    )
                    
                    if question_dict:
                        questions.append(question_dict)
                        
                except Exception as e:
                    self.logger.warning(f"Failed to parse numbered question on page {page_num}: {str(e)}")
                    continue
                    
        except Exception as e:
            self.logger.error(f"Text extraction failed for numbered page {page_num}: {str(e)}")
            raise
        
        return questions
    
    def process_standard_page(self, page, page_num: int) -> List[Dict]:
        """Process page using standard format."""
        questions = []
        
        try:
            text = page.extract_text()
            if not text or len(text.strip()) < 50:
                return questions
            
            # Pattern: Question\s+(\d+)[:,]?\s*(.*?)
            question_matches = list(self.format_patterns['standard'].finditer(text))
            
            for i, match in enumerate(question_matches):
                try:
                    start_pos = match.start()
                    if i + 1 < len(question_matches):
                        end_pos = question_matches[i + 1].start()
                    else:
                        end_pos = len(text)
                    
                    question_text = text[start_pos:end_pos].strip()
                    question_dict = self.parse_standard_content(
                        question_text,
                        int(match.group(2)),  # topic number
                        int(match.group(1)),  # question number
                        page_num
                    )
                    
                    if question_dict:
                        questions.append(question_dict)
                        
                except Exception as e:
                    self.logger.warning(f"Failed to parse standard question on page {page_num}: {str(e)}")
                    continue
                    
        except Exception as e:
            self.logger.error(f"Text extraction failed for standard page {page_num}: {str(e)}")
            raise
        
        return questions
    
    def process_legacy_page(self, page, page_num: int) -> List[Dict]:
        """Process page using legacy format (same as V1)."""
        questions = []
        
        try:
            text = page.extract_text()
            if not text or len(text.strip()) < 50:
                return questions
            
            # Pattern: Question #(\d+) Topic (\d+)
            question_matches = list(self.format_patterns['legacy'].finditer(text))
            
            for i, match in enumerate(question_matches):
                try:
                    start_pos = match.start()
                    if i + 1 < len(question_matches):
                        end_pos = question_matches[i + 1].start()
                    else:
                        end_pos = len(text)
                    
                    question_text = text[start_pos:end_pos].strip()
                    question_dict = self.parse_question_content(
                        question_text,
                        int(match.group(2)),  # topic number
                        int(match.group(1)),  # question number
                        page_num
                    )
                    
                    if question_dict:
                        questions.append(question_dict)
                        
                except Exception as e:
                    self.logger.warning(f"Failed to parse legacy question on page {page_num}: {str(e)}")
                    continue
                    
        except Exception as e:
            self.logger.error(f"Text extraction failed for legacy page {page_num}: {str(e)}")
            raise
        
        return questions
    
    def parse_surepassexam_content(self, content: str, topic_num: int, question_num: int, page_num: int) -> Optional[Dict]:
        """Parse SurePassExam format content."""
        try:
            # Remove header: NEW QUESTION X - (Topic Y)
            content = re.sub(r'^NEW\s+QUESTION\s+\d+\s*-\s*\((?:Exam\s+)?Topic\s+\d+\)\s*', '', content, flags=re.IGNORECASE)
            
            # Split on first "A. " occurrence
            answer_split = re.split(r'^A\.\s+', content, 1, re.MULTILINE)
            
            if len(answer_split) < 2:
                self.logger.warning(f"No answer options found for SurePassExam Q{question_num}")
                return None
            
            question_text = answer_split[0].strip()
            answer_section = 'A. ' + answer_split[1]
            
            options = self.extract_answer_options(answer_section)
            if not options:
                return None
            
            question_type, select_count = self.detect_question_type(content)
            
            if not self.validate_question_structure(question_text, options):
                return None
            
            return {
                'topic_number': topic_num,
                'question_number': question_num,
                'question_id': f't{topic_num}_q{question_num}',
                'question_text': question_text,
                'question_type': question_type,
                'select_count': select_count,
                'options': options,
                'page_number': page_num,
                'extraction_confidence': self.calculate_confidence(question_text, options),
                'format_type': 'surepassexam'
            }
            
        except Exception as e:
            self.logger.error(f"Failed to parse SurePassExam content: {str(e)}")
            return None
    
    def parse_simple_numbered_content(self, content: str, topic_num: int, question_num: int, page_num: int) -> Optional[Dict]:
        """Parse simple numbered format content (NEW QUESTION X)."""
        try:
            # Remove header: NEW QUESTION X
            content = re.sub(r'^NEW\s+QUESTION\s+\d+\s*', '', content, flags=re.IGNORECASE)
            
            # Split on first "A. " occurrence
            answer_split = re.split(r'^A\.\s+', content, 1, re.MULTILINE)
            
            if len(answer_split) < 2:
                # Try alternative patterns like "A)"
                answer_split = re.split(r'^A\)\s+', content, 1, re.MULTILINE)
                if len(answer_split) < 2:
                    self.logger.warning(f"No answer options found for simple numbered Q{question_num}")
                    return None
                answer_section = 'A) ' + answer_split[1]
            else:
                answer_section = 'A. ' + answer_split[1]
            
            question_text = answer_split[0].strip()
            
            options = self.extract_answer_options(answer_section)
            if not options:
                return None
            
            question_type, select_count = self.detect_question_type(content)
            
            if not self.validate_question_structure(question_text, options):
                return None
            
            return {
                'topic_number': topic_num,
                'question_number': question_num,
                'question_id': f't{topic_num}_q{question_num}',
                'question_text': question_text,
                'question_type': question_type,
                'select_count': select_count,
                'options': options,
                'page_number': page_num,
                'extraction_confidence': self.calculate_confidence(question_text, options),
                'format_type': 'simple_numbered'
            }
            
        except Exception as e:
            self.logger.error(f"Failed to parse simple numbered content: {str(e)}")
            return None
    
    def parse_numbered_content(self, content: str, topic_num: int, question_num: int, page_num: int) -> Optional[Dict]:
        """Parse numbered format content."""
        try:
            # Split on first "A. " occurrence
            answer_split = re.split(r'^A\.\s+', content, 1, re.MULTILINE)
            
            if len(answer_split) < 2:
                # Try alternative patterns like "A)"
                answer_split = re.split(r'^A\)\s+', content, 1, re.MULTILINE)
                if len(answer_split) < 2:
                    self.logger.warning(f"No answer options found for numbered Q{question_num}")
                    return None
                answer_section = 'A) ' + answer_split[1]
            else:
                answer_section = 'A. ' + answer_split[1]
            
            question_text = answer_split[0].strip()
            
            options = self.extract_answer_options(answer_section)
            if not options:
                return None
            
            question_type, select_count = self.detect_question_type(content)
            
            if not self.validate_question_structure(question_text, options):
                return None
            
            return {
                'topic_number': topic_num,
                'question_number': question_num,
                'question_id': f't{topic_num}_q{question_num}',
                'question_text': question_text,
                'question_type': question_type,
                'select_count': select_count,
                'options': options,
                'page_number': page_num,
                'extraction_confidence': self.calculate_confidence(question_text, options),
                'format_type': 'numbered'
            }
            
        except Exception as e:
            self.logger.error(f"Failed to parse numbered content: {str(e)}")
            return None
    
    def parse_standard_content(self, content: str, topic_num: int, question_num: int, page_num: int) -> Optional[Dict]:
        """Parse standard format content."""
        try:
            # Remove header: Question X Topic Y
            content = re.sub(r'^Question\s+(?:#)?\d+[:,]?\s+Topic\s+\d+\s*', '', content, flags=re.IGNORECASE)
            
            # Split on first "A. " occurrence
            answer_split = re.split(r'^A\.\s+', content, 1, re.MULTILINE)
            
            if len(answer_split) < 2:
                self.logger.warning(f"No answer options found for standard Q{question_num}")
                return None
            
            question_text = answer_split[0].strip()
            answer_section = 'A. ' + answer_split[1]
            
            options = self.extract_answer_options(answer_section)
            if not options:
                return None
            
            question_type, select_count = self.detect_question_type(content)
            
            if not self.validate_question_structure(question_text, options):
                return None
            
            return {
                'topic_number': topic_num,
                'question_number': question_num,
                'question_id': f't{topic_num}_q{question_num}',
                'question_text': question_text,
                'question_type': question_type,
                'select_count': select_count,
                'options': options,
                'page_number': page_num,
                'extraction_confidence': self.calculate_confidence(question_text, options),
                'format_type': 'standard'
            }
            
        except Exception as e:
            self.logger.error(f"Failed to parse standard content: {str(e)}")
            return None
    
    # Reuse existing methods from V1 with minimal changes
    def parse_question_content(self, content: str, topic_num: int, question_num: int, page_num: int) -> Optional[Dict]:
        """Parse legacy question content (V1 format)."""
        try:
            answer_split = re.split(r'^A\.\s+', content, 1, re.MULTILINE)
            
            if len(answer_split) < 2:
                self.logger.warning(f"No answer options found for legacy Q{question_num}")
                return None
            
            question_text = answer_split[0].strip()
            answer_section = 'A. ' + answer_split[1]
            
            # Clean up question text (remove question/topic header)
            question_text = re.sub(r'^Question\s+#\d+\s+Topic\s+\d+\s*', '', question_text, flags=re.IGNORECASE)
            question_text = question_text.strip()
            
            options = self.extract_answer_options(answer_section)
            if not options:
                return None
            
            question_type, select_count = self.detect_question_type(content)
            
            if not self.validate_question_structure(question_text, options):
                return None
            
            return {
                'topic_number': topic_num,
                'question_number': question_num,
                'question_id': f't{topic_num}_q{question_num}',
                'question_text': question_text,
                'question_type': question_type,
                'select_count': select_count,
                'options': options,
                'page_number': page_num,
                'extraction_confidence': self.calculate_confidence(question_text, options),
                'format_type': 'legacy'
            }
            
        except Exception as e:
            self.logger.error(f"Failed to parse legacy question content: {str(e)}")
            return None
    
    def extract_answer_options(self, answer_section: str) -> List[Tuple[str, str]]:
        """Extract answer options from answer section."""
        options = []
        
        # First try standard A. B. C. format
        matches = self.answer_pattern.findall(answer_section)
        
        # If no matches, try alternative format A) B) C)
        if not matches:
            alt_pattern = re.compile(r'^([A-E])\)\s+(.+?)(?=^[A-E]\)|$)', re.MULTILINE | re.DOTALL)
            matches = alt_pattern.findall(answer_section)
        
        for letter, text in matches:
            cleaned_text = re.sub(r'\s+', ' ', text.strip())
            if cleaned_text and len(cleaned_text) > 5:
                options.append([letter, cleaned_text])
        
        return options
    
    def detect_question_type(self, content: str) -> Tuple[str, int]:
        """Detect question type and number of correct answers."""
        content_lower = content.lower()
        
        if 'choose two' in content_lower or 'select two' in content_lower:
            return 'multiple_choice_2', 2
        elif 'choose three' in content_lower or 'select three' in content_lower:
            return 'multiple_choice_3', 3
        elif 'select all that apply' in content_lower:
            return 'select_all', -1
        else:
            return 'single_choice', 1
    
    def validate_question_structure(self, question_text: str, options: List[Tuple[str, str]]) -> bool:
        """Validate question structure."""
        if not question_text or len(question_text.strip()) < 20:
            return False
        
        if not options or len(options) < 3:
            return False
        
        if len(options) > 5:
            return False
        
        expected_letters = ['A', 'B', 'C', 'D', 'E']
        actual_letters = [opt[0] for opt in options]
        
        if actual_letters[0] != 'A':
            return False
        
        for i, letter in enumerate(actual_letters):
            if letter != expected_letters[i]:
                return False
        
        return True
    
    def calculate_confidence(self, question_text: str, options: List[Tuple[str, str]]) -> float:
        """Calculate extraction confidence score."""
        score = 0.0
        
        if question_text and len(question_text.strip()) > 20:
            score += 0.3
        
        if 4 <= len(options) <= 5:
            score += 0.3
        elif len(options) == 3:
            score += 0.2
        
        if options:
            avg_length = sum(len(opt[1]) for opt in options) / len(options)
            if avg_length > 20:
                score += 0.2
        
        if all(len(opt[1].strip()) > 5 for opt in options):
            score += 0.2
        
        return min(score, 1.0)
    
    def create_output(self, questions: List[Dict], pdf_format: str) -> Dict:
        """Create final output structure with V2 metadata."""
        success_rate = self.stats['processed_pages'] / self.stats['total_pages'] if self.stats['total_pages'] > 0 else 0
        
        topics = {}
        for q in questions:
            topic_num = q['topic_number']
            if topic_num not in topics:
                topics[topic_num] = []
            topics[topic_num].append(q)
        
        return {
            'metadata': {
                'parser_version': '2.0',
                'detected_format': pdf_format,
                'format_detection_scores': self.stats['format_detection_attempts'],
                'extraction_date': datetime.now().isoformat(),
                'total_pages': self.stats['total_pages'],
                'processed_pages': self.stats['processed_pages'],
                'failed_pages': self.stats['failed_pages'],
                'total_questions': len(questions),
                'total_topics': len(topics),
                'extraction_success_rate': round(success_rate, 3),
                'extraction_errors': self.stats['extraction_errors'],
                'question_types': self.get_question_type_stats(questions)
            },
            'questions': questions
        }
    
    def get_question_type_stats(self, questions: List[Dict]) -> Dict[str, int]:
        """Get statistics on question types."""
        stats = {}
        for q in questions:
            qtype = q['question_type']
            stats[qtype] = stats.get(qtype, 0) + 1
        return stats


def main():
    """Main entry point for V2 PDF parser."""
    parser = argparse.ArgumentParser(description='V2 Enhanced PDF parser with format detection')
    parser.add_argument('--input', required=True, help='Path to input PDF file')
    parser.add_argument('--output', required=True, help='Path to output JSON file')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    
    args = parser.parse_args()
    
    if not Path(args.input).exists():
        print(f"Error: Input file not found: {args.input}")
        sys.exit(1)
    
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    pdf_parser = V2PDFParser(log_level=args.log_level)
    
    try:
        result = pdf_parser.extract_questions(args.input)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        metadata = result['metadata']
        print(f"\n=== V2 PDF Extraction Complete ===")
        print(f"Detected format: {metadata['detected_format']}")
        print(f"Questions found: {metadata['total_questions']}")
        print(f"Topics: {metadata['total_topics']}")
        print(f"Success rate: {metadata['extraction_success_rate']:.1%}")
        print(f"Failed pages: {len(metadata['failed_pages'])}")
        print(f"Output saved to: {output_path}")
        
        if metadata['failed_pages']:
            print(f"Failed pages: {metadata['failed_pages']}")
        
        print(f"\nFormat detection scores:")
        for fmt, score in metadata['format_detection_scores'].items():
            print(f"  {fmt}: {score}")
        
        print(f"\nQuestion types:")
        for qtype, count in metadata['question_types'].items():
            print(f"  {qtype}: {count}")
            
    except Exception as e:
        print(f"Error during extraction: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()