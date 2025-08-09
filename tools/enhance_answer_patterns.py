#!/usr/bin/env python3
"""
Phase 2.1: Answer Pattern Enhancement Tool

Enhances answer parsing by adding more flexible patterns to catch edge cases
that the main parser missed.

Usage:
    python enhance_answer_patterns.py --input data/answers_raw.json --source "docs/exam-material/AWS SAA-03 Solution.txt" --output data/answers_enhanced.json
"""

import re
import json
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import sys


class AnswerEnhancer:
    """Enhance answer parsing with additional patterns for edge cases."""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize answer enhancer with logging."""
        self.setup_logging(log_level)
        
        # Additional patterns for edge cases
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
            # Pattern for standalone answer without letter: just look for AWS service patterns
            {
                'name': 'service_pattern',
                'pattern': re.compile(r'((?:Create|Use|Configure|Set up|Turn on|Enable|Add|Remove)\s+(?:an?|the)?\s*(?:Amazon\s+)?(?:AWS\s+)?[A-Z][a-zA-Z0-9\s]+(?:S3|EC2|VPC|RDS|Lambda|CloudWatch|IAM|ELB|SQS|SNS|DynamoDB|Kinesis|API Gateway|CloudFormation|Route 53|CloudFront)[^.]*\.?)', re.IGNORECASE),
                'priority': 7
            }
        ]
        
        self.stats = {
            'original_answers': 0,
            'enhancement_attempts': 0,
            'successful_enhancements': 0,
            'enhancement_patterns': {}
        }
    
    def setup_logging(self, level: str):
        """Configure logging."""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"answer_enhancer_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def enhance_answers(self, answers_file: str, source_file: str, output_file: str) -> Dict:
        """
        Enhance existing answers by trying to parse previously unparseable segments.
        
        Args:
            answers_file: Path to existing answers JSON
            source_file: Path to original text file
            output_file: Path to save enhanced results
            
        Returns:
            Enhanced answers dictionary
        """
        self.logger.info(f"Loading existing answers from: {answers_file}")
        
        # Load existing answers
        try:
            with open(answers_file, 'r', encoding='utf-8') as f:
                answers_data = json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load answers file: {str(e)}")
            raise
        
        self.stats['original_answers'] = len(answers_data['answers'])
        
        # Load source text
        try:
            with open(source_file, 'r', encoding='utf-8', errors='replace') as f:
                source_content = f.read()
        except Exception as e:
            self.logger.error(f"Failed to load source file: {str(e)}")
            raise
        
        self.logger.info(f"Attempting to enhance {len(answers_data['parsing_report']['unparseable_segments'])} unparseable segments")
        
        # Try to parse unparseable segments with enhanced patterns
        new_answers = []
        existing_answer_numbers = {a['answer_number'] for a in answers_data['answers']}
        
        for unparseable in answers_data['parsing_report']['unparseable_segments']:
            answer_num = unparseable['answer_number']
            if answer_num not in existing_answer_numbers:
                self.stats['enhancement_attempts'] += 1
                
                # Extract the segment content
                segment_content = self.extract_segment_content(source_content, answer_num)
                if segment_content:
                    enhanced_answer = self.try_enhanced_parsing(answer_num, segment_content)
                    if enhanced_answer:
                        new_answers.append(enhanced_answer)
                        self.stats['successful_enhancements'] += 1
        
        # Combine original and enhanced answers
        all_answers = answers_data['answers'] + new_answers
        all_answers.sort(key=lambda x: x['answer_number'])
        
        # Update metadata
        enhanced_metadata = answers_data['metadata'].copy()
        enhanced_metadata.update({
            'enhancement_date': datetime.now().isoformat(),
            'original_answers': self.stats['original_answers'],
            'enhanced_answers': len(new_answers),
            'total_answers': len(all_answers),
            'enhancement_success_rate': self.stats['successful_enhancements'] / self.stats['enhancement_attempts'] if self.stats['enhancement_attempts'] > 0 else 0,
            'enhancement_patterns': self.stats['enhancement_patterns']
        })
        
        result = {
            'metadata': enhanced_metadata,
            'answers': all_answers,
            'enhancement_report': {
                'original_count': self.stats['original_answers'],
                'enhancement_attempts': self.stats['enhancement_attempts'],
                'successful_enhancements': self.stats['successful_enhancements'],
                'enhancement_patterns_used': self.stats['enhancement_patterns'],
                'final_count': len(all_answers)
            }
        }
        
        # Save enhanced results
        try:
            output_path = Path(output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
                
            self.logger.info(f"Enhanced answers saved to: {output_path}")
            
        except Exception as e:
            self.logger.error(f"Failed to save enhanced answers: {str(e)}")
            raise
        
        return result
    
    def extract_segment_content(self, source_content: str, answer_number: int) -> Optional[str]:
        """Extract segment content for a specific answer number."""
        question_delimiter = re.compile(r'(\d+)\]', re.MULTILINE)
        matches = list(question_delimiter.finditer(source_content))
        
        for i, match in enumerate(matches):
            if int(match.group(1)) == answer_number:
                start_pos = match.start()
                if i + 1 < len(matches):
                    end_pos = matches[i + 1].start()
                else:
                    end_pos = len(source_content)
                
                segment_content = source_content[start_pos:end_pos].strip()
                return segment_content
        
        return None
    
    def try_enhanced_parsing(self, answer_number: int, segment_content: str) -> Optional[Dict]:
        """Try enhanced patterns on a segment."""
        # Clean content
        cleaned_content = self.clean_segment_content(segment_content)
        
        # Skip if content is too short or just separators
        if len(cleaned_content) < 50 or re.match(r'^[\d\]\s\-=]*$', cleaned_content):
            return None
        
        # Extract question preview
        question_preview = self.extract_question_preview(cleaned_content)
        
        # Try enhanced patterns
        for pattern_info in self.enhanced_patterns:
            pattern = pattern_info['pattern']
            format_name = pattern_info['name']
            
            match = pattern.search(cleaned_content)
            if match:
                # Extract answer text based on pattern type
                if format_name in ['letter_multi_space', 'letter_punct', 'option_format']:
                    if len(match.groups()) >= 2:
                        answer_text = match.group(2).strip()
                    else:
                        answer_text = match.group(1).strip()
                elif format_name == 'service_pattern':
                    answer_text = match.group(1).strip()
                else:
                    answer_text = match.group(0).strip()
                
                # Clean and validate answer
                cleaned_answer = self.clean_answer_text(answer_text)
                if self.validate_answer_text(cleaned_answer):
                    
                    # Track pattern usage
                    self.stats['enhancement_patterns'][format_name] = self.stats['enhancement_patterns'].get(format_name, 0) + 1
                    
                    # Extract explanation
                    explanation = self.extract_explanation(cleaned_content, cleaned_answer)
                    keywords = self.extract_keywords(explanation)
                    
                    return {
                        'answer_number': answer_number,
                        'question_preview': question_preview,
                        'correct_answer': cleaned_answer,
                        'answer_format': format_name,
                        'explanation': explanation,
                        'keywords': keywords,
                        'raw_text': segment_content[:500],
                        'parsing_confidence': self.calculate_confidence(cleaned_answer, explanation, question_preview),
                        'enhanced': True
                    }
        
        return None
    
    def clean_segment_content(self, content: str) -> str:
        """Clean segment content."""
        content = content.replace('\x00', ' ')
        content = content.replace('\ufeff', '')
        content = content.replace('\r\n', '\n').replace('\r', '\n')
        content = re.sub(r'[ \t]+', ' ', content)
        content = re.sub(r'\n\s*\n', '\n\n', content)
        return content.strip()
    
    def extract_question_preview(self, content: str) -> str:
        """Extract question preview text."""
        lines = content.split('\n')
        question_lines = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Stop at answer indicators or separators
            if (re.match(r'^[A-E][\.\):\-\s]', line) or
                '---' in line or
                line.lower().startswith('option') or
                re.match(r'^(Create|Use|Configure|Set up|Turn on|Enable)', line)):
                break
                
            question_lines.append(line)
        
        preview = ' '.join(question_lines)
        preview = re.sub(r'^\d+\]\s*', '', preview)
        
        if len(preview) > 300:
            preview = preview[:300] + '...'
            
        return preview.strip()
    
    def clean_answer_text(self, text: str) -> str:
        """Clean answer text."""
        text = re.sub(r'\s+', ' ', text)
        
        # Remove various prefixes
        text = re.sub(r'^Option\s+[A-E]\.?\s*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'^[A-E][\.\):\-]\s*', '', text)
        
        # For long text, extract main answer part
        if len(text) > 200:
            sentences = re.split(r'(?<=[.!])\s+', text)
            if sentences:
                answer_text = sentences[0]
                if len(answer_text) < 100 and len(sentences) > 1:
                    answer_text += ' ' + sentences[1]
                if len(answer_text) < 150 and len(sentences) > 2:
                    answer_text += ' ' + sentences[2]
                text = answer_text
        
        # Remove separators and clean up
        text = re.sub(r'[-=]{3,}.*$', '', text, flags=re.MULTILINE)
        text = text.replace('\n', ' ')
        text = re.sub(r'\s*[.]{2,}$', '', text)
        
        return text.strip()
    
    def validate_answer_text(self, text: str) -> bool:
        """Validate answer text."""
        if not text or len(text.strip()) < 10:
            return False
        if len(text) > 1000:
            return False
        return True
    
    def extract_explanation(self, content: str, answer_text: str) -> str:
        """Extract explanation text."""
        try:
            # Find content after the answer
            answer_pos = content.find(answer_text)
            if answer_pos == -1:
                return ""
            
            remaining_content = content[answer_pos + len(answer_text):]
            
            # Extract explanation lines
            explanation_lines = []
            lines = remaining_content.split('\n')
            
            for line in lines:
                line = line.strip()
                if not line or re.match(r'^[-=]{3,}', line):
                    if explanation_lines:
                        break
                    continue
                
                if line and not line.startswith(('A.', 'B.', 'C.', 'D.', 'E.')):
                    explanation_lines.append(line)
            
            explanation = ' '.join(explanation_lines)
            if len(explanation) > 800:
                explanation = explanation[:800] + '...'
                
            return explanation.strip()
            
        except Exception:
            return ""
    
    def extract_keywords(self, explanation: str) -> List[str]:
        """Extract AWS service keywords."""
        if not explanation:
            return []
        
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
        
        return found_keywords[:8]
    
    def calculate_confidence(self, answer_text: str, explanation: str, question_preview: str) -> float:
        """Calculate parsing confidence."""
        score = 0.5  # Base score for enhanced patterns
        
        if 20 <= len(answer_text) <= 200:
            score += 0.2
        elif 10 <= len(answer_text) <= 300:
            score += 0.1
        
        if explanation and len(explanation) > 30:
            score += 0.2
        
        if question_preview and len(question_preview) > 50:
            score += 0.1
        
        return min(score, 1.0)


def main():
    """Main entry point for answer enhancer."""
    parser = argparse.ArgumentParser(description='Enhance answer parsing with additional patterns')
    parser.add_argument('--input', required=True, help='Path to existing answers JSON file')
    parser.add_argument('--source', required=True, help='Path to original source text file')
    parser.add_argument('--output', required=True, help='Path to save enhanced answers')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    
    args = parser.parse_args()
    
    # Validate input files
    if not Path(args.input).exists():
        print(f"Error: Input file not found: {args.input}")
        sys.exit(1)
        
    if not Path(args.source).exists():
        print(f"Error: Source file not found: {args.source}")
        sys.exit(1)
    
    try:
        enhancer = AnswerEnhancer(log_level=args.log_level)
        result = enhancer.enhance_answers(args.input, args.source, args.output)
        
        # Print summary
        print(f"\n=== Answer Enhancement Complete ===")
        print(f"Original answers: {result['enhancement_report']['original_count']}")
        print(f"Enhancement attempts: {result['enhancement_report']['enhancement_attempts']}")
        print(f"Successfully enhanced: {result['enhancement_report']['successful_enhancements']}")
        print(f"Final answer count: {result['enhancement_report']['final_count']}")
        
        if result['enhancement_report']['enhancement_patterns_used']:
            print(f"\nPatterns used:")
            for pattern, count in result['enhancement_report']['enhancement_patterns_used'].items():
                print(f"  {pattern}: {count} answers")
        
        print(f"\nOutput saved to: {args.output}")
        
    except Exception as e:
        print(f"Enhancement failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()