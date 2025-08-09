#!/usr/bin/env python3
"""
PDF Parser Tool for AWS SAA-C03 Study App

Extracts structured question data from AWS Certified Solutions Architect 
Associate SAA-C03 PDF file with high reliability parsing.

Usage:
    python pdf_parser.py --input path/to/pdf --output path/to/output.json
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


class PDFParser:
    """Extract structured question data from AWS SAA-C03 PDF file."""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize PDF parser with logging."""
        self.setup_logging(log_level)
        self.question_pattern = re.compile(r'Question\s+#(\d+)\s+Topic\s+(\d+)', re.IGNORECASE)
        self.answer_pattern = re.compile(r'^([A-E])\.\s+(.+?)(?=^[A-E]\.|$)', re.MULTILINE | re.DOTALL)
        self.stats = {
            'total_pages': 0,
            'processed_pages': 0,
            'questions_found': 0,
            'failed_pages': [],
            'extraction_errors': []
        }
    
    def setup_logging(self, level: str):
        """Configure logging for the parser."""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"pdf_parser_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def extract_questions(self, pdf_path: str) -> Dict:
        """
        Extract all questions from PDF file.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Dict containing metadata and extracted questions
        """
        self.logger.info(f"Starting PDF extraction from: {pdf_path}")
        
        questions = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                self.stats['total_pages'] = len(pdf.pages)
                self.logger.info(f"PDF has {self.stats['total_pages']} pages")
                
                for page_num, page in enumerate(pdf.pages, 1):
                    try:
                        page_questions = self.process_page(page, page_num)
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
        self.logger.info(f"Extraction complete. Found {len(questions)} questions")
        
        return self.create_output(questions)
    
    def process_page(self, page, page_num: int) -> List[Dict]:
        """
        Extract questions from a single page.
        
        Args:
            page: pdfplumber page object
            page_num: Page number for logging
            
        Returns:
            List of question dictionaries
        """
        questions = []
        
        try:
            # Extract text from page
            text = page.extract_text()
            if not text or len(text.strip()) < 50:
                return questions
            
            # Find all question markers on this page
            question_matches = list(self.question_pattern.finditer(text))
            
            for i, match in enumerate(question_matches):
                try:
                    # Determine question boundaries
                    start_pos = match.start()
                    if i + 1 < len(question_matches):
                        end_pos = question_matches[i + 1].start()
                    else:
                        end_pos = len(text)
                    
                    # Extract question content
                    question_text = text[start_pos:end_pos].strip()
                    question_dict = self.parse_question_content(
                        question_text, 
                        int(match.group(2)),  # topic number (now second group)
                        int(match.group(1)),  # question number (now first group)
                        page_num
                    )
                    
                    if question_dict:
                        questions.append(question_dict)
                        
                except Exception as e:
                    self.logger.warning(f"Failed to parse question on page {page_num}: {str(e)}")
                    continue
                    
        except Exception as e:
            self.logger.error(f"Text extraction failed for page {page_num}: {str(e)}")
            raise
        
        return questions
    
    def parse_question_content(self, content: str, topic_num: int, question_num: int, page_num: int) -> Optional[Dict]:
        """
        Parse individual question content into structured format.
        
        Args:
            content: Raw question text
            topic_num: Topic number
            question_num: Question number  
            page_num: Page number
            
        Returns:
            Structured question dictionary or None if parsing fails
        """
        try:
            # Split question text from answer options
            # Look for first occurrence of "A. " to separate question from answers
            answer_split = re.split(r'^A\.\s+', content, 1, re.MULTILINE)
            
            if len(answer_split) < 2:
                self.logger.warning(f"No answer options found for Topic {topic_num} Question #{question_num}")
                return None
            
            question_text = answer_split[0].strip()
            answer_section = 'A. ' + answer_split[1]
            
            # Clean up question text (remove question/topic header)
            question_text = re.sub(r'^Question\s+#\d+\s+Topic\s+\d+\s*', '', question_text, flags=re.IGNORECASE)
            question_text = question_text.strip()
            
            # Extract answer options
            options = self.extract_answer_options(answer_section)
            if not options:
                self.logger.warning(f"No valid answer options for Topic {topic_num} Question #{question_num}")
                return None
            
            # Detect question type
            question_type, select_count = self.detect_question_type(content)
            
            # Validate structure
            if not self.validate_question_structure(question_text, options):
                self.logger.warning(f"Invalid structure for Topic {topic_num} Question #{question_num}")
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
                'extraction_confidence': self.calculate_confidence(question_text, options)
            }
            
        except Exception as e:
            self.logger.error(f"Failed to parse question content: {str(e)}")
            return None
    
    def extract_answer_options(self, answer_section: str) -> List[Tuple[str, str]]:
        """
        Extract answer options from answer section.
        
        Args:
            answer_section: Text containing answer options
            
        Returns:
            List of (letter, text) tuples
        """
        options = []
        
        # Find all answer options (A-E)
        matches = self.answer_pattern.findall(answer_section)
        
        for letter, text in matches:
            # Clean up answer text
            cleaned_text = re.sub(r'\s+', ' ', text.strip())
            if cleaned_text and len(cleaned_text) > 5:  # Minimum reasonable answer length
                options.append([letter, cleaned_text])
        
        return options
    
    def detect_question_type(self, content: str) -> Tuple[str, int]:
        """
        Detect question type and number of correct answers.
        
        Args:
            content: Full question content
            
        Returns:
            Tuple of (question_type, select_count)
        """
        content_lower = content.lower()
        
        if 'choose two' in content_lower:
            return 'multiple_choice_2', 2
        elif 'choose three' in content_lower:
            return 'multiple_choice_3', 3
        elif 'select all that apply' in content_lower:
            return 'select_all', -1  # -1 indicates variable number
        else:
            return 'single_choice', 1
    
    def validate_question_structure(self, question_text: str, options: List[Tuple[str, str]]) -> bool:
        """
        Validate that question has proper structure.
        
        Args:
            question_text: The question text
            options: List of answer options
            
        Returns:
            True if structure is valid
        """
        # Check minimum question length
        if not question_text or len(question_text.strip()) < 20:
            return False
        
        # Check answer options
        if not options or len(options) < 3:  # Minimum 3 options
            return False
        
        if len(options) > 5:  # Maximum 5 options
            return False
        
        # Check that options are properly lettered
        expected_letters = ['A', 'B', 'C', 'D', 'E']
        actual_letters = [opt[0] for opt in options]
        
        # Should start with A and be sequential
        if actual_letters[0] != 'A':
            return False
        
        for i, letter in enumerate(actual_letters):
            if letter != expected_letters[i]:
                return False
        
        return True
    
    def calculate_confidence(self, question_text: str, options: List[Tuple[str, str]]) -> float:
        """
        Calculate extraction confidence score.
        
        Args:
            question_text: The question text
            options: List of answer options
            
        Returns:
            Confidence score between 0 and 1
        """
        score = 0.0
        
        # Base score for having content
        if question_text and len(question_text.strip()) > 20:
            score += 0.3
        
        # Score for number of options
        if 4 <= len(options) <= 5:
            score += 0.3
        elif len(options) == 3:
            score += 0.2
        
        # Score for option quality
        if options:
            avg_length = sum(len(opt[1]) for opt in options) / len(options)
            if avg_length > 20:  # Reasonable answer length
                score += 0.2
        
        # Score for proper formatting
        if all(len(opt[1].strip()) > 5 for opt in options):
            score += 0.2
        
        return min(score, 1.0)
    
    def create_output(self, questions: List[Dict]) -> Dict:
        """
        Create final output structure with metadata.
        
        Args:
            questions: List of extracted questions
            
        Returns:
            Complete output dictionary
        """
        # Calculate success rate
        success_rate = self.stats['processed_pages'] / self.stats['total_pages'] if self.stats['total_pages'] > 0 else 0
        
        # Group questions by topic
        topics = {}
        for q in questions:
            topic_num = q['topic_number']
            if topic_num not in topics:
                topics[topic_num] = []
            topics[topic_num].append(q)
        
        return {
            'metadata': {
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
    """Main entry point for PDF parser."""
    parser = argparse.ArgumentParser(description='Extract questions from AWS SAA-C03 PDF')
    parser.add_argument('--input', required=True, help='Path to input PDF file')
    parser.add_argument('--output', required=True, help='Path to output JSON file')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    
    args = parser.parse_args()
    
    # Validate input file
    if not Path(args.input).exists():
        print(f"Error: Input file not found: {args.input}")
        sys.exit(1)
    
    # Create output directory if needed
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Run extraction
    pdf_parser = PDFParser(log_level=args.log_level)
    
    try:
        result = pdf_parser.extract_questions(args.input)
        
        # Save results
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        # Print summary
        metadata = result['metadata']
        print(f"\n=== PDF Extraction Complete ===")
        print(f"Questions found: {metadata['total_questions']}")
        print(f"Topics: {metadata['total_topics']}")
        print(f"Success rate: {metadata['extraction_success_rate']:.1%}")
        print(f"Failed pages: {len(metadata['failed_pages'])}")
        print(f"Output saved to: {output_path}")
        
        if metadata['failed_pages']:
            print(f"Failed pages: {metadata['failed_pages']}")
        
        # Print question type distribution
        print(f"\nQuestion types:")
        for qtype, count in metadata['question_types'].items():
            print(f"  {qtype}: {count}")
            
    except Exception as e:
        print(f"Error during extraction: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()