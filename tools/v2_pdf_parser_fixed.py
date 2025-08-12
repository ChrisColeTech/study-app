#!/usr/bin/env python3
"""
V2 PDF Parser Tool - FIXED VERSION for Complete Question Extraction

This fixed version extracts the ENTIRE PDF text first, then parses questions globally
instead of page-by-page to handle questions that span multiple pages.

Usage:
    python v2_pdf_parser_fixed.py --input path/to/pdf --output path/to/output.json
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


class V2PDFParserFixed:
    """Fixed PDF parser that extracts complete PDF text before parsing questions."""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize fixed V2 PDF parser with logging."""
        self.setup_logging(log_level)
        
        # Enhanced format detection patterns
        self.format_patterns = {
            'surepassexam': re.compile(
                r'NEW\s+QUESTION\s+(\d+)\s*(?:-\s*\((?:Exam\s+)?Topic\s+(\d+)\))?', 
                re.IGNORECASE
            ),
            'numbered': re.compile(r'^\d+\.\s+', re.MULTILINE),
            'standard': re.compile(r'Question\s+(?:#)?(\d+)', re.IGNORECASE),
        }
        
        # Question content extraction patterns
        self.question_splitter = re.compile(
            r'NEW\s+QUESTION\s+(\d+)\s*(?:-\s*\((?:Exam\s+)?Topic\s+(\d+)\))?', 
            re.IGNORECASE
        )
        
        # Answer pattern - matches A. B. C. D. E. options
        self.option_pattern = re.compile(
            r'^([A-E])\.\s+(.+?)(?=^[A-E]\.|Answer:|Explanation:|NEW\s+QUESTION|\Z)', 
            re.MULTILINE | re.DOTALL
        )
        
        # Answer extraction pattern
        self.answer_pattern = re.compile(
            r'Answer:\s*([A-E]+)',
            re.IGNORECASE
        )
        
        # Explanation pattern
        self.explanation_pattern = re.compile(
            r'Explanation:\s*(.*?)(?=NEW\s+QUESTION|\Z)',
            re.DOTALL | re.IGNORECASE
        )
        
        self.stats = {
            'total_pages': 0,
            'total_text_length': 0,
            'questions_found': 0,
            'questions_with_answers': 0,
            'questions_with_explanations': 0,
            'extraction_errors': [],
            'detected_format': None
        }
    
    def setup_logging(self, level: str):
        """Configure logging for the parser."""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"v2_pdf_parser_fixed_{timestamp}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def extract_full_text(self, pdf_path: str) -> str:
        """
        Extract complete text from entire PDF.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Complete PDF text as string
        """
        self.logger.info(f"Extracting complete text from: {pdf_path}")
        
        full_text = ""
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                self.stats['total_pages'] = len(pdf.pages)
                self.logger.info(f"PDF has {self.stats['total_pages']} pages")
                
                for page_num, page in enumerate(pdf.pages, 1):
                    try:
                        page_text = page.extract_text()
                        if page_text:
                            # Add page separator for debugging
                            full_text += f"\n--- PAGE {page_num} ---\n{page_text}\n"
                        
                        if page_num % 10 == 0:
                            self.logger.info(f"Extracted text from {page_num} pages")
                            
                    except Exception as e:
                        self.logger.warning(f"Failed to extract text from page {page_num}: {str(e)}")
                        continue
                        
        except Exception as e:
            self.logger.error(f"Failed to open PDF: {str(e)}")
            raise
        
        self.stats['total_text_length'] = len(full_text)
        self.logger.info(f"Extracted {len(full_text):,} characters from {self.stats['total_pages']} pages")
        
        return full_text
    
    def detect_format(self, text: str) -> str:
        """
        Detect the question format used in the PDF.
        
        Args:
            text: Complete PDF text
            
        Returns:
            Detected format: 'surepassexam', 'numbered', or 'standard'
        """
        self.logger.info("Detecting PDF format from complete text")
        
        # Count occurrences of each format pattern
        surepass_matches = len(self.format_patterns['surepassexam'].findall(text))
        numbered_matches = len(self.format_patterns['numbered'].findall(text))
        standard_matches = len(self.format_patterns['standard'].findall(text))
        
        self.logger.info(f"Format detection results:")
        self.logger.info(f"  SurePassExam: {surepass_matches} matches")
        self.logger.info(f"  Numbered: {numbered_matches} matches") 
        self.logger.info(f"  Standard: {standard_matches} matches")
        
        # Prioritize SurePassExam if it has any matches
        if surepass_matches >= max(numbered_matches, standard_matches) and surepass_matches > 0:
            detected_format = 'surepassexam'
        elif numbered_matches > standard_matches:
            detected_format = 'numbered'
        else:
            detected_format = 'standard'
        
        self.logger.info(f"Detected format: {detected_format}")
        self.stats['detected_format'] = detected_format
        
        return detected_format
    
    def extract_questions(self, pdf_path: str) -> Dict:
        """
        Extract ALL questions from PDF file using complete text parsing.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Dict containing metadata and extracted questions
        """
        self.logger.info(f"Starting FIXED V2 PDF extraction from: {pdf_path}")
        
        # Step 1: Extract complete PDF text
        full_text = self.extract_full_text(pdf_path)
        
        if len(full_text) < 100:
            self.logger.error("PDF text extraction failed or PDF is too short")
            raise ValueError("Failed to extract sufficient text from PDF")
        
        # Step 2: Detect format
        pdf_format = self.detect_format(full_text)
        
        # Step 3: Parse questions based on detected format
        if pdf_format == 'surepassexam':
            questions = self.parse_surepassexam_questions(full_text)
        elif pdf_format == 'numbered':
            questions = self.parse_numbered_questions(full_text)
        else:
            questions = self.parse_standard_questions(full_text)
        
        self.stats['questions_found'] = len(questions)
        self.logger.info(f"Extraction complete. Found {len(questions)} total questions using {pdf_format} format")
        
        return self.create_output(questions, pdf_format, pdf_path)
    
    def parse_surepassexam_questions(self, text: str) -> List[Dict]:
        """
        Parse questions from SurePassExam format text.
        
        Args:
            text: Complete PDF text
            
        Returns:
            List of question dictionaries
        """
        self.logger.info("Parsing SurePassExam format questions from complete text")
        
        questions = []
        
        # Find all question headers with their positions
        question_matches = list(self.question_splitter.finditer(text))
        self.logger.info(f"Found {len(question_matches)} question headers")
        
        for i, match in enumerate(question_matches):
            try:
                # Extract question number and topic
                question_num = int(match.group(1))
                topic_match = match.group(2)
                topic_num = int(topic_match) if topic_match and topic_match.isdigit() else 3  # Default to Topic 3
                
                # Get content from this question to the next (or end of text)
                start_pos = match.end()
                if i + 1 < len(question_matches):
                    end_pos = question_matches[i + 1].start()
                else:
                    end_pos = len(text)
                
                content = text[start_pos:end_pos].strip()
                
                # Parse the question content
                question_dict = self.parse_question_content(content, question_num, topic_num)
                
                if question_dict:
                    questions.append(question_dict)
                    self.logger.debug(f"Parsed question {question_num}")
                else:
                    self.logger.warning(f"Failed to parse content for question {question_num}")
                    
            except (ValueError, IndexError) as e:
                self.logger.warning(f"Failed to parse question {i+1}: {str(e)}")
                self.stats['extraction_errors'].append(f"Question {i+1}: {str(e)}")
                continue
        
        self.logger.info(f"Successfully parsed {len(questions)} SurePassExam questions")
        return questions
    
    def parse_question_content(self, content: str, question_num: int, topic_num: int) -> Optional[Dict]:
        """
        Parse individual question content to extract question text, options, answer, and explanation.
        
        Args:
            content: Raw question content
            question_num: Question number
            topic_num: Topic number
            
        Returns:
            Question dictionary or None if parsing failed
        """
        try:
            # Clean content
            content = content.strip()
            
            # Extract question text (everything before first option)
            option_match = self.option_pattern.search(content)
            if option_match:
                question_text = content[:option_match.start()].strip()
            else:
                # No options found, take first paragraph as question
                lines = content.split('\n')
                question_text = lines[0] if lines else content[:200]
                
            # Remove page markers and clean question text
            question_text = re.sub(r'--- PAGE \d+ ---', '', question_text)
            question_text = re.sub(r'NEW\s+QUESTION\s+\d+(?:\s*-\s*\((?:Exam\s+)?Topic\s+\d+\))?', '', question_text, flags=re.IGNORECASE)
            question_text = question_text.strip()
            
            if len(question_text) < 10:
                self.logger.warning(f"Question {question_num}: Question text too short")
                return None
            
            # Extract options
            options = []
            option_matches = list(self.option_pattern.finditer(content))
            
            for opt_match in option_matches:
                option_letter = opt_match.group(1)
                option_text = opt_match.group(2).strip()
                # Clean option text
                option_text = re.sub(r'--- PAGE \d+ ---', '', option_text)
                option_text = ' '.join(option_text.split())  # Normalize whitespace
                options.append({
                    'letter': option_letter,
                    'text': option_text
                })
            
            # Extract answer
            answer_match = self.answer_pattern.search(content)
            correct_answer = answer_match.group(1) if answer_match else None
            
            # Extract explanation
            explanation_match = self.explanation_pattern.search(content)
            explanation = explanation_match.group(1).strip() if explanation_match else ""
            
            # Clean explanation
            if explanation:
                explanation = re.sub(r'--- PAGE \d+ ---', '', explanation)
                explanation = ' '.join(explanation.split())  # Normalize whitespace
                self.stats['questions_with_explanations'] += 1
            
            if correct_answer:
                self.stats['questions_with_answers'] += 1
            
            question_dict = {
                'question_number': question_num,
                'topic': topic_num,
                'question_text': question_text,
                'options': options,
                'correct_answer': correct_answer,
                'explanation': explanation,
                'metadata': {
                    'extraction_method': 'fixed_v2_parser',
                    'format': 'surepassexam',
                    'options_count': len(options),
                    'has_answer': bool(correct_answer),
                    'has_explanation': bool(explanation.strip()),
                    'content_length': len(content)
                }
            }
            
            return question_dict
            
        except Exception as e:
            self.logger.error(f"Failed to parse question {question_num} content: {str(e)}")
            self.stats['extraction_errors'].append(f"Question {question_num}: {str(e)}")
            return None
    
    def parse_numbered_questions(self, text: str) -> List[Dict]:
        """Parse numbered format questions (1. 2. 3. etc.)"""
        self.logger.info("Parsing numbered format - placeholder implementation")
        return []
    
    def parse_standard_questions(self, text: str) -> List[Dict]:
        """Parse standard format questions"""
        self.logger.info("Parsing standard format - placeholder implementation")  
        return []
    
    def create_output(self, questions: List[Dict], pdf_format: str, pdf_path: str) -> Dict:
        """
        Create formatted output structure.
        
        Args:
            questions: List of extracted questions
            pdf_format: Detected PDF format
            pdf_path: Source PDF path
            
        Returns:
            Formatted output dictionary
        """
        filename = Path(pdf_path).stem
        
        output = {
            'metadata': {
                'filename': filename,
                'extraction_timestamp': datetime.now().isoformat(),
                'parser_version': 'v2_fixed',
                'detected_format': pdf_format,
                'total_pages': self.stats['total_pages'],
                'total_text_length': self.stats['total_text_length'],
                'questions_extracted': len(questions),
                'questions_with_answers': self.stats['questions_with_answers'],
                'questions_with_explanations': self.stats['questions_with_explanations'],
                'extraction_success_rate': f"{(len(questions) / max(1, self.stats['questions_found'])) * 100:.1f}%",
                'extraction_errors': len(self.stats['extraction_errors'])
            },
            'questions': questions,
            'statistics': self.stats
        }
        
        return output


def main():
    """Main function to run the fixed PDF parser."""
    parser = argparse.ArgumentParser(description='V2 Fixed PDF Parser for Study App')
    parser.add_argument('--input', '-i', required=True, help='Input PDF file path')
    parser.add_argument('--output', '-o', help='Output JSON file path (optional)')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    
    args = parser.parse_args()
    
    # Initialize parser
    pdf_parser = V2PDFParserFixed(log_level=args.log_level)
    
    try:
        # Extract questions
        result = pdf_parser.extract_questions(args.input)
        
        # Determine output path
        if args.output:
            output_path = Path(args.output)
        else:
            input_path = Path(args.input)
            output_path = input_path.parent / f"{input_path.stem}_fixed_questions.json"
        
        # Save results
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        print(f"\n=== EXTRACTION COMPLETE ===")
        print(f"Questions extracted: {len(result['questions'])}")
        print(f"Questions with answers: {result['metadata']['questions_with_answers']}")
        print(f"Questions with explanations: {result['metadata']['questions_with_explanations']}")
        print(f"Output saved to: {output_path}")
        
        if result['statistics']['extraction_errors']:
            print(f"Extraction errors: {len(result['statistics']['extraction_errors'])}")
        
    except Exception as e:
        pdf_parser.logger.error(f"Failed to process PDF: {str(e)}")
        print(f"Error: {str(e)}")
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())