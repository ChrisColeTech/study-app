#!/usr/bin/env python3
"""
Answer Parser Tool - Phase 2

Extracts correct answers and explanations from AWS SAA-03 Solution.txt file
with multi-format parsing to handle inconsistent text formatting.

Usage:
    python answer_parser.py --input "docs/exam-material/AWS SAA-03 Solution.txt" --output data/answers_raw.json
"""

import re
import json
import logging
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import sys


class AnswerParser:
    """Extract correct answers and explanations from non-standard text file."""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize answer parser with logging and patterns."""
        self.setup_logging(log_level)
        
        # Question segmentation pattern
        self.question_delimiter = re.compile(r'(\d+)\]', re.MULTILINE)
        
        # Multiple answer format patterns (in order of preference)
        self.answer_patterns = [
            # Pattern 1: ans- format
            {
                'name': 'ans_format',
                'pattern': re.compile(r'ans-\s*(.+?)(?=\n\n|\n[A-Z]|$)', re.DOTALL | re.IGNORECASE),
                'priority': 1
            },
            # Pattern 2: Letter with period format
            {
                'name': 'letter_format', 
                'pattern': re.compile(r'^([A-E])\.\s*(.+?)(?=\n\n|$)', re.MULTILINE | re.DOTALL),
                'priority': 2
            },
            # Pattern 3: Letter without period format
            {
                'name': 'hybrid_format',
                'pattern': re.compile(r'^([A-E])\s+(.+?)(?=\n\n|$)', re.MULTILINE | re.DOTALL),
                'priority': 3
            }
        ]
        
        # Separator pattern for explanations
        self.separator_pattern = re.compile(r'^[-=]{3,}', re.MULTILINE)
        
        # Statistics tracking
        self.stats = {
            'total_segments': 0,
            'successfully_parsed': 0,
            'format_distribution': {},
            'parsing_errors': [],
            'low_confidence_answers': [],
            'unparseable_segments': []
        }
    
    def setup_logging(self, level: str):
        """Configure logging for the parser."""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"answer_parser_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def parse_answers(self, text_path: str) -> Dict:
        """
        Parse answers from text file.
        
        Args:
            text_path: Path to the answer text file
            
        Returns:
            Dict containing metadata and extracted answers
        """
        self.logger.info(f"Starting answer parsing from: {text_path}")
        
        # Read the text file
        try:
            with open(text_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
        except Exception as e:
            self.logger.error(f"Failed to read text file: {str(e)}")
            raise
        
        self.logger.info(f"Loaded text file: {len(content)} characters")
        
        # Segment by question numbers
        segments = self.segment_by_questions(content)
        self.logger.info(f"Found {len(segments)} question segments")
        
        # Parse each segment
        answers = []
        for i, segment in enumerate(segments):
            try:
                answer_data = self.parse_segment(segment['number'], segment['content'])
                if answer_data:
                    answers.append(answer_data)
                    self.stats['successfully_parsed'] += 1
                
                if (i + 1) % 50 == 0:
                    self.logger.info(f"Processed {i + 1} segments, extracted {len(answers)} answers")
                    
            except Exception as e:
                self.logger.error(f"Failed to parse segment {segment['number']}: {str(e)}")
                self.stats['parsing_errors'].append({
                    'answer_number': segment['number'],
                    'error': str(e),
                    'content_preview': segment['content'][:200]
                })
                continue
        
        self.stats['total_segments'] = len(segments)
        self.logger.info(f"Parsing complete. Extracted {len(answers)} answers from {len(segments)} segments")
        
        return self.create_output(answers, text_path)
    
    def segment_by_questions(self, content: str) -> List[Dict]:
        """
        Segment text by question numbers.
        
        Args:
            content: Full text content
            
        Returns:
            List of question segments with number and content
        """
        segments = []
        
        # Find all question number matches
        matches = list(self.question_delimiter.finditer(content))
        
        for i, match in enumerate(matches):
            question_num = int(match.group(1))
            start_pos = match.start()
            
            # Determine end position
            if i + 1 < len(matches):
                end_pos = matches[i + 1].start()
            else:
                end_pos = len(content)
            
            # Extract segment content
            segment_content = content[start_pos:end_pos].strip()
            
            if len(segment_content) > 50:  # Minimum reasonable segment size
                segments.append({
                    'number': question_num,
                    'content': segment_content
                })
        
        return segments
    
    def parse_segment(self, answer_number: int, segment_content: str) -> Optional[Dict]:
        """
        Parse a single question segment to extract answer and explanation.
        
        Args:
            answer_number: Question/answer number
            segment_content: Text content for this segment
            
        Returns:
            Parsed answer dictionary or None if parsing fails
        """
        # Clean the segment content
        cleaned_content = self.clean_segment_content(segment_content)
        
        # Extract question preview (first part before answer)
        question_preview = self.extract_question_preview(cleaned_content)
        
        # Try to parse answer using multiple formats
        answer_data = self.extract_answer_multiple_formats(cleaned_content)
        
        if not answer_data:
            self.logger.warning(f"Could not extract answer from segment {answer_number}")
            self.stats['unparseable_segments'].append({
                'answer_number': answer_number,
                'content_preview': cleaned_content[:300],
                'reason': 'No answer format matched'
            })
            return None
        
        # Extract explanation
        explanation = self.extract_explanation(cleaned_content, answer_data['answer_text'])
        
        # Extract keywords from explanation
        keywords = self.extract_keywords(explanation)
        
        # Calculate confidence score
        confidence = self.calculate_parsing_confidence(answer_data, explanation, question_preview)
        
        # Track low confidence items
        if confidence < 0.5:
            self.stats['low_confidence_answers'].append({
                'answer_number': answer_number,
                'confidence': confidence,
                'format_used': answer_data['format'],
                'preview': question_preview[:100]
            })
        
        # Track format distribution
        format_name = answer_data['format']
        self.stats['format_distribution'][format_name] = self.stats['format_distribution'].get(format_name, 0) + 1
        
        return {
            'answer_number': answer_number,
            'question_preview': question_preview,
            'correct_answer': answer_data['answer_text'],
            'answer_format': format_name,
            'explanation': explanation,
            'keywords': keywords,
            'raw_text': segment_content[:500],  # First 500 chars for reference
            'parsing_confidence': round(confidence, 3)
        }
    
    def clean_segment_content(self, content: str) -> str:
        """Clean and normalize segment content."""
        # Remove null characters and other problematic chars
        content = content.replace('\x00', ' ')
        content = content.replace('\ufeff', '')  # BOM
        
        # Normalize line endings first
        content = content.replace('\r\n', '\n').replace('\r', '\n')
        
        # Clean up excessive whitespace but preserve line structure for regex matching
        # Only collapse multiple spaces on the same line, keep newlines
        content = re.sub(r'[ \t]+', ' ', content)  # Multiple spaces/tabs -> single space
        content = re.sub(r'\n\s*\n', '\n\n', content)  # Multiple blank lines -> double newline
        
        return content.strip()
    
    def extract_question_preview(self, content: str) -> str:
        """Extract question preview text (before answer)."""
        # Look for question text before any answer indicator
        lines = content.split('\n')
        question_lines = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Stop at answer indicators
            if (line.lower().startswith('ans-') or 
                re.match(r'^[A-E]\.?\s', line) or
                '---' in line or
                line.lower().startswith('correct') or
                line.lower().startswith('option')):
                break
                
            question_lines.append(line)
        
        preview = ' '.join(question_lines)
        
        # Remove question number prefix
        preview = re.sub(r'^\d+\]\s*', '', preview)
        
        # Limit length for preview
        if len(preview) > 300:
            preview = preview[:300] + '...'
            
        return preview.strip()
    
    def extract_answer_multiple_formats(self, content: str) -> Optional[Dict]:
        """
        Try multiple answer format patterns to extract the correct answer.
        
        Args:
            content: Segment content
            
        Returns:
            Dict with answer_text and format, or None if no match
        """
        for pattern_info in self.answer_patterns:
            pattern = pattern_info['pattern']
            format_name = pattern_info['name']
            
            match = pattern.search(content)
            if match:
                if format_name == 'ans_format':
                    # ans- format: full match is the answer
                    answer_text = match.group(1).strip()
                else:
                    # Letter formats: second group is the answer text (already without letter prefix)
                    if len(match.groups()) >= 2:
                        answer_text = match.group(2).strip()  # This already excludes the "A. " part
                    else:
                        answer_text = match.group(1).strip()
                
                # Clean the answer text
                answer_text = self.clean_answer_text(answer_text)
                
                # Validate answer quality
                if self.validate_answer_text(answer_text):
                    return {
                        'answer_text': answer_text,
                        'format': format_name,
                        'match_confidence': self.calculate_match_confidence(match, content)
                    }
        
        return None
    
    def clean_answer_text(self, text: str) -> str:
        """Clean and normalize answer text."""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove ans- prefix if present (for ans_format answers)
        text = text.replace('ans-', '').strip()
        
        # For long text, try to extract just the main answer part
        if len(text) > 200:
            # Look for sentence endings that might indicate end of main answer
            sentences = re.split(r'(?<=[.!])\s+', text)
            if sentences:
                # Take first 1-3 sentences depending on length
                answer_text = sentences[0]
                if len(answer_text) < 100 and len(sentences) > 1:
                    answer_text += ' ' + sentences[1]
                if len(answer_text) < 150 and len(sentences) > 2:
                    answer_text += ' ' + sentences[2]
                text = answer_text
        
        # Remove separator artifacts
        text = re.sub(r'[-=]{3,}.*$', '', text, flags=re.MULTILINE)
        
        # Clean up line endings within the text
        text = text.replace('\n', ' ')
        
        # Remove trailing punctuation artifacts
        text = re.sub(r'\s*[.]{2,}$', '', text)
        
        # Remove common explanation starters if they appear at the end
        for phrase in [' General line:', ' Conditions:', ' Task:', ' Requirements:', ' Correct answer', ' because:', ' provides', ' allows']:
            if phrase in text:
                text = text.split(phrase)[0]
        
        return text.strip()
    
    def validate_answer_text(self, text: str) -> bool:
        """Validate that answer text is reasonable."""
        if not text or len(text.strip()) < 5:
            return False
            
        # Allow longer text but we'll clean it up later
        if len(text) > 5000:  # Only reject extremely long text
            return False
            
        return True
    
    def calculate_match_confidence(self, match: re.Match, content: str) -> float:
        """Calculate confidence score for regex match."""
        score = 0.5  # Base score
        
        # Bonus for match position (earlier is better for answers)
        match_pos = match.start() / len(content)
        if match_pos < 0.3:  # Answer appears in first 30% of content
            score += 0.2
        
        # Bonus for reasonable answer length
        answer_length = len(match.group(1) if len(match.groups()) >= 1 else match.group(0))
        if 20 <= answer_length <= 200:
            score += 0.2
        
        # Penalty for very long matches (likely includes explanation)
        if answer_length > 500:
            score -= 0.3
        
        return min(score, 1.0)
    
    def extract_explanation(self, content: str, answer_text: str) -> str:
        """Extract explanation text from segment."""
        # Split content after the answer
        try:
            # Find where answer ends
            answer_end = content.find(answer_text) + len(answer_text)
            remaining_content = content[answer_end:]
            
            # Look for explanation indicators
            explanation_lines = []
            lines = remaining_content.split('\n')
            
            collecting_explanation = False
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Skip separator lines
                if re.match(r'^[-=]{3,}', line):
                    if explanation_lines:  # End of explanation
                        break
                    continue
                
                # Look for explanation start indicators
                if (any(indicator in line.lower() for indicator in [
                    'because:', 'explanation:', 'correct answer', 'option',
                    'ideally', 'provides', 'allows', 'enables'
                ]) or collecting_explanation):
                    collecting_explanation = True
                    explanation_lines.append(line)
                elif collecting_explanation and line and not line.startswith(('A.', 'B.', 'C.', 'D.', 'E.')):
                    explanation_lines.append(line)
                elif collecting_explanation:
                    break  # Stop at next answer option
            
            explanation = ' '.join(explanation_lines)
            
            # Clean up the explanation
            explanation = re.sub(r'\s+', ' ', explanation)
            explanation = explanation.replace('because:', '').strip()
            
            # Limit explanation length
            if len(explanation) > 1000:
                explanation = explanation[:1000] + '...'
                
            return explanation.strip()
            
        except Exception:
            # Fallback: try to extract any explanatory text
            lines = content.split('\n')[2:]  # Skip first lines (likely question/answer)
            explanation_text = ' '.join([line.strip() for line in lines if line.strip() and not re.match(r'^[-=]{3,}', line)])
            
            if len(explanation_text) > 1000:
                explanation_text = explanation_text[:1000] + '...'
                
            return explanation_text.strip()
    
    def extract_keywords(self, explanation: str) -> List[str]:
        """Extract AWS service keywords from explanation."""
        if not explanation:
            return []
        
        # Common AWS service keywords
        aws_keywords = [
            'S3', 'EC2', 'VPC', 'RDS', 'Lambda', 'CloudWatch', 'IAM', 'EBS', 'ELB',
            'Auto Scaling', 'CloudFormation', 'Route 53', 'CloudFront', 'SQS', 'SNS',
            'DynamoDB', 'Kinesis', 'API Gateway', 'ElastiCache', 'ECS', 'EKS'
        ]
        
        found_keywords = []
        explanation_upper = explanation.upper()
        
        for keyword in aws_keywords:
            if keyword.upper() in explanation_upper:
                found_keywords.append(keyword)
        
        return found_keywords[:10]  # Limit to 10 keywords
    
    def calculate_parsing_confidence(self, answer_data: Dict, explanation: str, question_preview: str) -> float:
        """Calculate overall parsing confidence score."""
        score = 0.0
        
        # Base score from match confidence
        score += answer_data.get('match_confidence', 0.3) * 0.4
        
        # Answer quality score
        answer_text = answer_data.get('answer_text', '')
        if 20 <= len(answer_text) <= 300:
            score += 0.2
        elif 10 <= len(answer_text) <= 500:
            score += 0.1
        
        # Explanation quality score
        if explanation and len(explanation) > 50:
            score += 0.2
        elif explanation:
            score += 0.1
        
        # Question preview quality score
        if question_preview and len(question_preview) > 30:
            score += 0.2
        elif question_preview:
            score += 0.1
        
        return min(score, 1.0)
    
    def create_output(self, answers: List[Dict], text_path: str) -> Dict:
        """Create final output structure with metadata."""
        # Calculate success rate
        success_rate = self.stats['successfully_parsed'] / self.stats['total_segments'] if self.stats['total_segments'] > 0 else 0
        
        # Calculate average confidence
        confidences = [a['parsing_confidence'] for a in answers if 'parsing_confidence' in a]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        return {
            'metadata': {
                'parsing_date': datetime.now().isoformat(),
                'source_file': str(text_path),
                'total_segments': self.stats['total_segments'],
                'total_answers': len(answers),
                'parsing_success_rate': round(success_rate, 3),
                'average_confidence': round(avg_confidence, 3),
                'format_distribution': self.stats['format_distribution'],
                'low_confidence_count': len(self.stats['low_confidence_answers']),
                'unparseable_count': len(self.stats['unparseable_segments']),
                'parsing_errors': len(self.stats['parsing_errors'])
            },
            'answers': answers,
            'parsing_report': {
                'format_breakdown': self.stats['format_distribution'],
                'low_confidence_answers': self.stats['low_confidence_answers'][:10],  # First 10
                'unparseable_segments': self.stats['unparseable_segments'],  # All segments
                'parsing_errors': self.stats['parsing_errors'][:5]  # First 5
            }
        }


def main():
    """Main entry point for answer parser."""
    parser = argparse.ArgumentParser(description='Extract answers from AWS SAA-03 Solution text file')
    parser.add_argument('--input', required=True, help='Path to input text file')
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
    
    # Run parsing
    answer_parser = AnswerParser(log_level=args.log_level)
    
    try:
        result = answer_parser.parse_answers(args.input)
        
        # Save results
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        # Print summary
        metadata = result['metadata']
        print(f"\n=== Answer Parsing Complete ===")
        print(f"Answers extracted: {metadata['total_answers']}")
        print(f"Success rate: {metadata['parsing_success_rate']:.1%}")
        print(f"Average confidence: {metadata['average_confidence']:.3f}")
        print(f"Low confidence answers: {metadata['low_confidence_count']}")
        print(f"Unparseable segments: {metadata['unparseable_count']}")
        
        print(f"\nFormat distribution:")
        for format_name, count in metadata['format_distribution'].items():
            percentage = (count / metadata['total_answers']) * 100
            print(f"  {format_name}: {count} ({percentage:.1f}%)")
        
        print(f"\nOutput saved to: {output_path}")
        
    except Exception as e:
        print(f"Error during parsing: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()