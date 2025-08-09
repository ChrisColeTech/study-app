#!/usr/bin/env python3
"""
Phase 2.3: Aggressive Content Parser

Uses highly flexible patterns and heuristics to extract answers from
the most challenging segments that previous parsers couldn't handle.

Usage:
    python aggressive_parser.py --source "docs/exam-material/AWS SAA-03 Solution.txt" --classification data/segment_analysis.json --output data/answers_aggressive.json
"""

import re
import json
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set
import sys


class AggressiveParser:
    """Aggressive parser for difficult answer segments."""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize aggressive parser with logging."""
        self.setup_logging(log_level)
        
        # Ultra-flexible patterns (ordered by reliability)
        self.aggressive_patterns = [
            # Pattern 1: Letter with any separator and space
            {
                'name': 'letter_flexible',
                'pattern': re.compile(r'([A-E])[.\)\:\-\s]{1,3}([A-Z][^A-E\n]{20,500})', re.MULTILINE),
                'priority': 1
            },
            # Pattern 2: Capital letter followed by action word
            {
                'name': 'action_based',
                'pattern': re.compile(r'([A-E])[.\)\:\-\s]*([A-Z](?:reate|se|onfigure|et up|nable|dd|emove|igrate|eploy|mplement)[^A-E\n]{15,400})', re.MULTILINE | re.IGNORECASE),
                'priority': 2
            },
            # Pattern 3: AWS service mentions after letter
            {
                'name': 'aws_service_based',
                'pattern': re.compile(r'([A-E])[.\)\:\-\s]*([^A-E\n]*(?:Amazon|AWS)[^A-E\n]{20,400})', re.MULTILINE),
                'priority': 3
            },
            # Pattern 4: Any meaningful sentence after letter
            {
                'name': 'sentence_based',
                'pattern': re.compile(r'([A-E])[.\)\:\-\s]*([A-Z][^A-E\n]{25,400}\.)', re.MULTILINE),
                'priority': 4
            },
            # Pattern 5: Line-based extraction (most aggressive)
            {
                'name': 'line_extraction',
                'pattern': re.compile(r'([A-E])[.\)\:\-\s]*(.{30,500}?)(?=\n[A-E][.\)\:\-\s]|\n\n|\Z)', re.MULTILINE | re.DOTALL),
                'priority': 5
            },
            # Pattern 6: Standalone AWS services/actions (no letter prefix)
            {
                'name': 'standalone_action',
                'pattern': re.compile(r'((?:Create|Use|Configure|Set up|Enable|Deploy|Implement|Add|Migrate|Turn on)\s+(?:an?|the)?\s*(?:Amazon\s+|AWS\s+)?[A-Z][a-zA-Z0-9\s]+(?:S3|EC2|VPC|RDS|Lambda|CloudWatch|IAM|ELB|SQS|SNS|DynamoDB|CloudFormation|Route 53)[^.]{0,200}\.)', re.IGNORECASE),
                'priority': 6
            },
            # Pattern 7: Question-based heuristic (extract most AWS-heavy sentence)
            {
                'name': 'aws_heavy_heuristic',
                'pattern': re.compile(r'([^.!?]{20,400}(?:Amazon|AWS)[^.!?]{0,200}[.!?])', re.MULTILINE),
                'priority': 7
            }
        ]
        
        # AWS service keywords for validation
        self.aws_keywords = {
            'S3', 'EC2', 'VPC', 'RDS', 'Lambda', 'CloudWatch', 'IAM', 'EBS', 'ELB',
            'Auto Scaling', 'CloudFormation', 'Route 53', 'CloudFront', 'SQS', 'SNS',
            'DynamoDB', 'Kinesis', 'API Gateway', 'ElastiCache', 'ECS', 'EKS',
            'Elastic Beanstalk', 'Systems Manager', 'Secrets Manager', 'WAF',
            'Direct Connect', 'Transit Gateway', 'NAT Gateway', 'Internet Gateway'
        }
        
        self.stats = {
            'target_segments': 0,
            'extraction_attempts': 0,
            'successful_extractions': 0,
            'pattern_usage': {},
            'confidence_distribution': {'high': 0, 'medium': 0, 'low': 0}
        }
    
    def setup_logging(self, level: str):
        """Configure logging."""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"aggressive_parser_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def parse_aggressive(self, source_file: str, classification_file: str, output_file: str) -> Dict:
        """
        Aggressively parse difficult answer segments.
        
        Args:
            source_file: Path to source text file
            classification_file: Path to segment classification results
            output_file: Path to save aggressive parsing results
            
        Returns:
            Aggressive parsing results dictionary
        """
        self.logger.info(f"Loading classification data: {classification_file}")
        
        # Load classification data
        try:
            with open(classification_file, 'r', encoding='utf-8') as f:
                classification_data = json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load classification file: {str(e)}")
            raise
        
        # Load source text
        try:
            with open(source_file, 'r', encoding='utf-8', errors='replace') as f:
                source_content = f.read()
        except Exception as e:
            self.logger.error(f"Failed to load source file: {str(e)}")
            raise
        
        # Get content segments to target
        content_segments = classification_data['categories']['has_content']
        self.stats['target_segments'] = len(content_segments)
        
        self.logger.info(f"Targeting {self.stats['target_segments']} content segments for aggressive parsing")
        
        # Extract segments from source
        source_segments = self.extract_segments(source_content)
        
        # Parse each content segment aggressively
        extracted_answers = []
        for segment_num in content_segments:
            if segment_num in source_segments:
                self.stats['extraction_attempts'] += 1
                
                segment_content = source_segments[segment_num]
                self.logger.debug(f"Processing segment {segment_num}")
                
                answer_data = self.extract_answer_aggressive(segment_num, segment_content)
                if answer_data:
                    extracted_answers.append(answer_data)
                    self.stats['successful_extractions'] += 1
                    
                    # Track confidence distribution
                    conf_level = 'high' if answer_data['parsing_confidence'] >= 0.7 else 'medium' if answer_data['parsing_confidence'] >= 0.5 else 'low'
                    self.stats['confidence_distribution'][conf_level] += 1
        
        # Calculate success rate
        success_rate = self.stats['successful_extractions'] / self.stats['extraction_attempts'] if self.stats['extraction_attempts'] > 0 else 0
        
        # Create result structure
        result = {
            'metadata': {
                'parsing_date': datetime.now().isoformat(),
                'source_file': source_file,
                'classification_file': classification_file,
                'target_segments': self.stats['target_segments'],
                'extraction_attempts': self.stats['extraction_attempts'],
                'successful_extractions': self.stats['successful_extractions'],
                'success_rate': round(success_rate, 3),
                'pattern_usage': self.stats['pattern_usage'],
                'confidence_distribution': self.stats['confidence_distribution']
            },
            'answers': sorted(extracted_answers, key=lambda x: x['answer_number']),
            'parsing_report': {
                'successful_segments': [ans['answer_number'] for ans in extracted_answers],
                'failed_segments': [num for num in content_segments if num not in source_segments or not any(ans['answer_number'] == num for ans in extracted_answers)],
                'pattern_effectiveness': self.calculate_pattern_effectiveness()
            }
        }
        
        # Save results
        try:
            output_path = Path(output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
                
            self.logger.info(f"Aggressive parsing results saved to: {output_path}")
            
        except Exception as e:
            self.logger.error(f"Failed to save results: {str(e)}")
            raise
        
        return result
    
    def extract_segments(self, source_content: str) -> Dict[int, str]:
        """Extract all segments from source content."""
        question_delimiter = re.compile(r'(\d+)\]', re.MULTILINE)
        matches = list(question_delimiter.finditer(source_content))
        
        segments = {}
        for i, match in enumerate(matches):
            question_num = int(match.group(1))
            start_pos = match.start()
            
            if i + 1 < len(matches):
                end_pos = matches[i + 1].start()
            else:
                end_pos = len(source_content)
            
            segment_content = source_content[start_pos:end_pos].strip()
            segments[question_num] = segment_content
        
        return segments
    
    def extract_answer_aggressive(self, answer_number: int, segment_content: str) -> Optional[Dict]:
        """Apply aggressive patterns to extract answer."""
        # Clean segment content
        cleaned_content = self.clean_segment_content(segment_content)
        
        # Try each aggressive pattern
        best_answer = None
        best_confidence = 0
        best_pattern = None
        
        for pattern_info in self.aggressive_patterns:
            pattern = pattern_info['pattern']
            pattern_name = pattern_info['name']
            
            matches = pattern.findall(cleaned_content)
            if matches:
                for match in matches:
                    answer_candidate = self.process_pattern_match(match, pattern_name)
                    if answer_candidate:
                        confidence = self.calculate_confidence_aggressive(
                            answer_candidate, cleaned_content, pattern_name
                        )
                        
                        if confidence > best_confidence:
                            best_answer = answer_candidate
                            best_confidence = confidence
                            best_pattern = pattern_name
        
        if best_answer and best_confidence >= 0.3:  # Lower threshold for aggressive parsing
            # Track pattern usage
            self.stats['pattern_usage'][best_pattern] = self.stats['pattern_usage'].get(best_pattern, 0) + 1
            
            # Extract additional info
            question_preview = self.extract_question_preview(cleaned_content)
            explanation = self.extract_explanation_aggressive(cleaned_content, best_answer)
            keywords = self.extract_aws_keywords(explanation + " " + best_answer)
            
            return {
                'answer_number': answer_number,
                'question_preview': question_preview,
                'correct_answer': best_answer,
                'answer_format': best_pattern,
                'explanation': explanation,
                'keywords': keywords,
                'raw_text': segment_content[:800] + "..." if len(segment_content) > 800 else segment_content,
                'parsing_confidence': best_confidence,
                'aggressive_extraction': True
            }
        
        return None
    
    def process_pattern_match(self, match, pattern_name: str) -> Optional[str]:
        """Process pattern match to extract clean answer text."""
        if pattern_name in ['letter_flexible', 'action_based', 'aws_service_based', 'sentence_based', 'line_extraction']:
            # These patterns have letter + answer format
            if isinstance(match, tuple) and len(match) >= 2:
                answer_text = match[1].strip()
            else:
                answer_text = match.strip() if isinstance(match, str) else str(match).strip()
        else:
            # Standalone patterns
            answer_text = match.strip() if isinstance(match, str) else str(match).strip()
        
        # Clean answer text
        answer_text = self.clean_answer_text_aggressive(answer_text)
        
        # Validate minimum quality
        if len(answer_text) < 15 or len(answer_text) > 800:
            return None
        
        return answer_text
    
    def clean_segment_content(self, content: str) -> str:
        """Clean segment content for processing."""
        # Remove control characters
        content = content.replace('\x00', ' ').replace('\ufeff', '')
        content = content.replace('\r\n', '\n').replace('\r', '\n')
        
        # Normalize whitespace but preserve line breaks
        content = re.sub(r'[ \t]+', ' ', content)
        content = re.sub(r'\n\s*\n', '\n\n', content)
        
        return content.strip()
    
    def clean_answer_text_aggressive(self, text: str) -> str:
        """Aggressively clean answer text."""
        # Remove prefixes
        text = re.sub(r'^[A-E][.\):;\-\s]*', '', text)
        text = re.sub(r'^Option\s+[A-E][.\):\s]*', '', text, flags=re.IGNORECASE)
        
        # Clean up whitespace and formatting
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'^[\s\-=]+', '', text)
        text = re.sub(r'[\s\-=]+$', '', text)
        
        # Extract main sentence(s)
        sentences = re.split(r'(?<=[.!])\s+', text)
        if sentences:
            # Take first 2-3 sentences if they're substantial
            main_text = sentences[0]
            if len(main_text) < 80 and len(sentences) > 1:
                main_text += ' ' + sentences[1]
            if len(main_text) < 120 and len(sentences) > 2:
                main_text += ' ' + sentences[2]
            text = main_text
        
        return text.strip()
    
    def calculate_confidence_aggressive(self, answer_text: str, segment_content: str, pattern_name: str) -> float:
        """Calculate confidence score for aggressive extraction."""
        confidence = 0.3  # Base confidence for aggressive parsing
        
        # Pattern reliability bonus
        pattern_bonus = {
            'letter_flexible': 0.3,
            'action_based': 0.25,
            'aws_service_based': 0.2,
            'sentence_based': 0.15,
            'line_extraction': 0.1,
            'standalone_action': 0.2,
            'aws_heavy_heuristic': 0.1
        }
        confidence += pattern_bonus.get(pattern_name, 0)
        
        # Length bonus (reasonable length)
        if 20 <= len(answer_text) <= 200:
            confidence += 0.2
        elif 15 <= len(answer_text) <= 300:
            confidence += 0.1
        
        # AWS keyword bonus
        aws_count = sum(1 for keyword in self.aws_keywords if keyword in answer_text)
        confidence += min(aws_count * 0.05, 0.15)
        
        # Action word bonus
        action_words = ['create', 'use', 'configure', 'set up', 'enable', 'deploy', 'implement', 'add', 'migrate']
        action_count = sum(1 for word in action_words if word.lower() in answer_text.lower())
        confidence += min(action_count * 0.03, 0.1)
        
        # Penalty for too short/long
        if len(answer_text) < 15:
            confidence -= 0.3
        elif len(answer_text) > 400:
            confidence -= 0.2
        
        return min(confidence, 1.0)
    
    def extract_question_preview(self, segment_content: str) -> str:
        """Extract question preview from segment."""
        lines = segment_content.split('\n')
        question_lines = []
        
        for line in lines[:10]:  # First 10 lines
            line = line.strip()
            if not line:
                continue
                
            # Stop at answer indicators
            if re.match(r'^[A-E][.\):\s]', line):
                break
            if line.startswith('---') or line.startswith('==='):
                break
                
            question_lines.append(line)
        
        preview = ' '.join(question_lines)
        preview = re.sub(r'^\d+\]\s*', '', preview)
        
        if len(preview) > 400:
            preview = preview[:400] + '...'
            
        return preview.strip()
    
    def extract_explanation_aggressive(self, segment_content: str, answer_text: str) -> str:
        """Extract explanation text aggressively."""
        try:
            # Find position after answer
            answer_pos = segment_content.find(answer_text)
            if answer_pos == -1:
                # Try to find similar content
                words = answer_text.split()[:5]  # First 5 words
                for word in words:
                    if len(word) > 4:
                        pos = segment_content.find(word)
                        if pos != -1:
                            answer_pos = pos
                            break
            
            if answer_pos != -1:
                remaining_content = segment_content[answer_pos + len(answer_text):]
                
                # Extract explanation lines
                lines = remaining_content.split('\n')
                explanation_lines = []
                
                for line in lines[:15]:  # First 15 lines after answer
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith('---') or line.startswith('==='):
                        break
                    if re.match(r'^[A-E][.\):]', line):
                        continue
                        
                    explanation_lines.append(line)
                    if len(' '.join(explanation_lines)) > 600:
                        break
                
                explanation = ' '.join(explanation_lines)
                return explanation[:800] + '...' if len(explanation) > 800 else explanation
                
        except Exception:
            pass
        
        return ""
    
    def extract_aws_keywords(self, text: str) -> List[str]:
        """Extract AWS service keywords."""
        found_keywords = []
        text_upper = text.upper()
        
        for keyword in self.aws_keywords:
            if keyword.upper() in text_upper:
                found_keywords.append(keyword)
        
        return found_keywords[:8]
    
    def calculate_pattern_effectiveness(self) -> Dict:
        """Calculate effectiveness of each pattern."""
        effectiveness = {}
        total_usage = sum(self.stats['pattern_usage'].values())
        
        if total_usage > 0:
            for pattern, count in self.stats['pattern_usage'].items():
                effectiveness[pattern] = {
                    'usage_count': count,
                    'usage_percentage': round(count / total_usage * 100, 1)
                }
        
        return effectiveness


def main():
    """Main entry point for aggressive parser."""
    parser = argparse.ArgumentParser(description='Aggressively parse difficult answer segments')
    parser.add_argument('--source', required=True, help='Path to source text file')
    parser.add_argument('--classification', required=True, help='Path to segment classification JSON')
    parser.add_argument('--output', required=True, help='Path to save aggressive parsing results')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    
    args = parser.parse_args()
    
    # Validate input files
    if not Path(args.source).exists():
        print(f"Error: Source file not found: {args.source}")
        sys.exit(1)
        
    if not Path(args.classification).exists():
        print(f"Error: Classification file not found: {args.classification}")
        sys.exit(1)
    
    try:
        aggressive_parser = AggressiveParser(log_level=args.log_level)
        result = aggressive_parser.parse_aggressive(args.source, args.classification, args.output)
        
        # Print summary
        print(f"\\n=== Aggressive Parsing Complete ===")
        print(f"Target segments: {result['metadata']['target_segments']}")
        print(f"Extraction attempts: {result['metadata']['extraction_attempts']}")
        print(f"Successful extractions: {result['metadata']['successful_extractions']}")
        print(f"Success rate: {result['metadata']['success_rate']*100:.1f}%")
        
        if result['metadata']['pattern_usage']:
            print(f"\\nPattern usage:")
            for pattern, count in result['metadata']['pattern_usage'].items():
                print(f"  {pattern}: {count} extractions")
        
        print(f"\\nConfidence distribution:")
        conf_dist = result['metadata']['confidence_distribution']
        print(f"  High (≥0.7): {conf_dist['high']}")
        print(f"  Medium (0.5-0.7): {conf_dist['medium']}")
        print(f"  Low (<0.5): {conf_dist['low']}")
        
        print(f"\\nOutput saved to: {args.output}")
        
    except Exception as e:
        print(f"Aggressive parsing failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()