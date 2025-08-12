#!/usr/bin/env python3
"""
Phase 3 V2 Tools: Aggressive Answer Recovery
Adapted from aggressive_parser.py for PDF input and V2 pipeline integration

Uses highly flexible patterns and heuristics to extract answers from 
questions that remain unanswered after Phase 2 enhanced processing.

Usage:
    python v2_aggressive_parser.py --pdf docs/exam-material/clf-c02_2.pdf --enhanced data/v2/clf-c02_2_enhanced.json --output data/v2/clf-c02_2_aggressive.json
"""

import re
import json
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set
import sys
import fitz  # PyMuPDF


class V2AggressiveParser:
    """Aggressive parser for remaining unanswered questions after Phase 2."""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize V2 aggressive parser with logging."""
        self.setup_logging(log_level)
        
        # Ultra-flexible patterns for answer extraction (ordered by reliability)
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
            },
            # Pattern 8: Answer indicators without letters
            {
                'name': 'answer_indicator',
                'pattern': re.compile(r'(?:Answer|Solution|Correct)[\s:]+([^A-E\n]{30,400})', re.IGNORECASE),
                'priority': 8
            },
            # Pattern 9: Context-based inference from question options
            {
                'name': 'option_context',
                'pattern': re.compile(r'([A-Z][^.!?]{20,300}[.!?])', re.MULTILINE),
                'priority': 9
            }
        ]
        
        # AWS service keywords for validation and inference
        self.aws_keywords = {
            'S3', 'EC2', 'VPC', 'RDS', 'Lambda', 'CloudWatch', 'IAM', 'EBS', 'ELB',
            'Auto Scaling', 'CloudFormation', 'Route 53', 'CloudFront', 'SQS', 'SNS',
            'DynamoDB', 'Kinesis', 'API Gateway', 'ElastiCache', 'ECS', 'EKS',
            'Elastic Beanstalk', 'Systems Manager', 'Secrets Manager', 'WAF',
            'Direct Connect', 'Transit Gateway', 'NAT Gateway', 'Internet Gateway',
            'Config', 'Trusted Advisor', 'Inspector', 'GuardDuty', 'Macie', 'KMS',
            'Certificate Manager', 'Directory Service', 'SSO', 'Organizations'
        }
        
        # Action keywords for inference
        self.action_keywords = {
            'create', 'configure', 'setup', 'enable', 'deploy', 'implement', 'use',
            'add', 'remove', 'migrate', 'scale', 'monitor', 'secure', 'backup',
            'restore', 'optimize', 'troubleshoot', 'analyze', 'evaluate'
        }
        
        self.stats = {
            'total_questions': 0,
            'unanswered_questions': 0,
            'aggressive_attempts': 0,
            'aggressive_successes': 0,
            'pattern_usage': {},
            'confidence_distribution': {'high': 0, 'medium': 0, 'low': 0},
            'inference_types': {}
        }
    
    def setup_logging(self, level: str):
        """Configure logging."""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"v2_aggressive_parser_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def parse_aggressive(self, pdf_file: str, enhanced_file: str, output_file: str) -> Dict:
        """
        Apply aggressive parsing to unanswered questions from Phase 2.
        
        Args:
            pdf_file: Path to source PDF file
            enhanced_file: Path to Phase 2 enhanced results
            output_file: Path to save aggressive parsing results
            
        Returns:
            Aggressive parsing results dictionary
        """
        self.logger.info(f"Starting aggressive parsing for {pdf_file}")
        self.logger.info(f"Using Phase 2 enhanced results: {enhanced_file}")
        
        # Load Phase 2 enhanced results
        try:
            with open(enhanced_file, 'r', encoding='utf-8') as f:
                enhanced_data = json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load enhanced file: {str(e)}")
            raise
        
        # Extract PDF content
        pdf_content = self.extract_pdf_content(pdf_file)
        
        # Identify unanswered questions
        unanswered_questions = self.identify_unanswered_questions(enhanced_data)
        self.stats['total_questions'] = len(enhanced_data.get('answers', []))
        self.stats['unanswered_questions'] = len(unanswered_questions)
        
        self.logger.info(f"Found {self.stats['unanswered_questions']} unanswered questions out of {self.stats['total_questions']} total")
        
        # Apply aggressive parsing to unanswered questions
        aggressive_answers = []
        for question_data in unanswered_questions:
            self.stats['aggressive_attempts'] += 1
            
            answer_result = self.extract_answer_aggressively(question_data, pdf_content)
            if answer_result:
                aggressive_answers.append(answer_result)
                self.stats['aggressive_successes'] += 1
                
                # Track confidence distribution
                conf_level = 'high' if answer_result['parsing_confidence'] >= 0.7 else 'medium' if answer_result['parsing_confidence'] >= 0.5 else 'low'
                self.stats['confidence_distribution'][conf_level] += 1
        
        # Calculate success metrics
        aggressive_rate = (self.stats['aggressive_successes'] / self.stats['aggressive_attempts']) * 100 if self.stats['aggressive_attempts'] > 0 else 0
        additional_coverage = (self.stats['aggressive_successes'] / self.stats['total_questions']) * 100 if self.stats['total_questions'] > 0 else 0
        
        # Create result structure
        result = {
            'metadata': {
                'parsing_date': datetime.now().isoformat(),
                'pdf_file': pdf_file,
                'enhanced_file': enhanced_file,
                'phase': 'aggressive_recovery',
                'total_questions': self.stats['total_questions'],
                'unanswered_questions': self.stats['unanswered_questions'],
                'aggressive_attempts': self.stats['aggressive_attempts'],
                'aggressive_successes': self.stats['aggressive_successes'],
                'aggressive_success_rate': round(aggressive_rate, 1),
                'additional_coverage_percent': round(additional_coverage, 1),
                'pattern_usage': self.stats['pattern_usage'],
                'confidence_distribution': self.stats['confidence_distribution'],
                'inference_types': self.stats['inference_types']
            },
            'aggressive_answers': sorted(aggressive_answers, key=lambda x: x['question_number']),
            'unanswered_remain': [q['question_id'] for q in unanswered_questions 
                                 if not any(a['question_id'] == q['question_id'] for a in aggressive_answers)],
            'parsing_report': {
                'successful_extractions': [ans['question_id'] for ans in aggressive_answers],
                'pattern_effectiveness': self.calculate_pattern_effectiveness(),
                'requires_ai_completion': len([q for q in unanswered_questions 
                                              if not any(a['question_id'] == q['question_id'] for a in aggressive_answers)])
            }
        }
        
        # Save results
        self.save_results(result, output_file)
        
        return result
    
    def extract_pdf_content(self, pdf_file: str) -> str:
        """Extract text content from PDF file."""
        try:
            doc = fitz.open(pdf_file)
            full_text = ""
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                page_text = page.get_text()
                full_text += page_text + "\n"
            
            doc.close()
            return full_text
            
        except Exception as e:
            self.logger.error(f"Failed to extract PDF content: {str(e)}")
            raise
    
    def identify_unanswered_questions(self, enhanced_data: Dict) -> List[Dict]:
        """Identify questions that still don't have answers after Phase 2."""
        unanswered = []
        
        for answer_data in enhanced_data.get('answers', []):
            # Check if question has a valid answer
            has_valid_answer = (
                answer_data.get('correct_answers') and 
                len(answer_data['correct_answers']) > 0 and
                answer_data.get('raw_answer_text') and
                answer_data['raw_answer_text'].strip()
            )
            
            if not has_valid_answer:
                unanswered.append(answer_data)
        
        return unanswered
    
    def extract_answer_aggressively(self, question_data: Dict, pdf_content: str) -> Optional[Dict]:
        """Apply aggressive patterns to extract answer for a specific question."""
        question_number = question_data.get('question_number')
        question_text = question_data.get('question_text', '')
        options = question_data.get('options', [])
        
        self.logger.debug(f"Aggressively parsing question {question_number}")
        
        # Find question context in PDF
        question_context = self.find_question_context(question_number, pdf_content)
        if not question_context:
            self.logger.debug(f"No context found for question {question_number}")
            return None
        
        # Try aggressive patterns
        best_answer = None
        best_confidence = 0
        best_method = None
        
        # Method 1: Pattern-based extraction
        for pattern_info in self.aggressive_patterns:
            pattern = pattern_info['pattern']
            pattern_name = pattern_info['name']
            
            matches = pattern.findall(question_context)
            if matches:
                for match in matches:
                    answer_candidate = self.process_aggressive_match(match, pattern_name, options)
                    if answer_candidate:
                        confidence = self.calculate_aggressive_confidence(
                            answer_candidate, question_context, pattern_name, question_text, options
                        )
                        
                        if confidence > best_confidence:
                            best_answer = answer_candidate
                            best_confidence = confidence
                            best_method = pattern_name
        
        # Method 2: Context inference from options
        if not best_answer or best_confidence < 0.4:
            inferred_answer = self.infer_from_context(question_text, options, question_context)
            if inferred_answer:
                inference_confidence = 0.35  # Base confidence for inference
                if inference_confidence > best_confidence:
                    best_answer = inferred_answer
                    best_confidence = inference_confidence
                    best_method = 'context_inference'
                    self.stats['inference_types']['context'] = self.stats['inference_types'].get('context', 0) + 1
        
        # Method 3: Keyword-based inference
        if not best_answer or best_confidence < 0.3:
            keyword_answer = self.infer_from_keywords(question_text, options, question_context)
            if keyword_answer:
                keyword_confidence = 0.25  # Lower confidence for keyword matching
                if keyword_confidence > best_confidence:
                    best_answer = keyword_answer
                    best_confidence = keyword_confidence
                    best_method = 'keyword_inference'
                    self.stats['inference_types']['keyword'] = self.stats['inference_types'].get('keyword', 0) + 1
        
        if best_answer and best_confidence >= 0.2:  # Very low threshold for aggressive parsing
            # Track pattern usage
            if best_method:
                self.stats['pattern_usage'][best_method] = self.stats['pattern_usage'].get(best_method, 0) + 1
            
            # Extract letter(s) from answer
            answer_letters = self.extract_answer_letters(best_answer['raw_text'])
            if answer_letters:
                # Map to indices
                correct_answers = [ord(letter.upper()) - ord('A') for letter in answer_letters if 'A' <= letter.upper() <= 'E']
                
                return {
                    'question_id': question_data.get('question_id'),
                    'question_number': question_number,
                    'raw_answer_text': best_answer['raw_text'],
                    'extraction_method': best_method,
                    'correct_answers': correct_answers,
                    'validation_confidence': best_confidence,
                    'mapping_issues': best_answer.get('issues', []),
                    'mapping_method': 'aggressive_extraction',
                    'explanation': best_answer.get('explanation', ''),
                    'keywords': self.extract_keywords(best_answer['raw_text'] + ' ' + best_answer.get('explanation', '')),
                    'requires_manual_review': True,  # All aggressive extractions need review
                    'aggressive_extraction': True,
                    'parsing_confidence': best_confidence
                }
        
        return None
    
    def find_question_context(self, question_number: int, pdf_content: str) -> str:
        """Find the context around a specific question in the PDF content."""
        # Try different question number formats
        patterns = [
            rf'{question_number}\.\s',      # "123. "
            rf'{question_number}\)\s',      # "123) "  
            rf'Question\s+{question_number}',  # "Question 123"
            rf'Q{question_number}[^0-9]',   # "Q123"
            rf'\n{question_number}\s',      # Line starting with number
        ]
        
        for pattern in patterns:
            match = re.search(pattern, pdf_content, re.IGNORECASE)
            if match:
                start = match.start()
                # Get context (about 2000 characters)
                context = pdf_content[max(0, start - 200):start + 2000]
                return context.strip()
        
        return ""
    
    def process_aggressive_match(self, match, pattern_name: str, options: List[Dict]) -> Optional[Dict]:
        """Process pattern match to extract clean answer information."""
        if pattern_name in ['letter_flexible', 'action_based', 'aws_service_based', 'sentence_based', 'line_extraction']:
            # These patterns have letter + answer format
            if isinstance(match, tuple) and len(match) >= 2:
                letter = match[0].strip()
                answer_text = match[1].strip()
                raw_text = f"{letter}. {answer_text}"
            else:
                raw_text = match.strip() if isinstance(match, str) else str(match).strip()
                answer_text = raw_text
        else:
            # Standalone patterns
            raw_text = match.strip() if isinstance(match, str) else str(match).strip()
            answer_text = raw_text
        
        # Clean answer text
        clean_text = self.clean_answer_text(answer_text)
        
        # Validate minimum quality
        if len(clean_text) < 10 or len(clean_text) > 1000:
            return None
        
        return {
            'raw_text': raw_text,
            'clean_text': clean_text,
            'explanation': clean_text,
            'issues': []
        }
    
    def infer_from_context(self, question_text: str, options: List[Dict], context: str) -> Optional[Dict]:
        """Infer answer from question and context analysis."""
        if not options:
            return None
        
        # Score each option based on context relevance
        option_scores = []
        
        for i, option in enumerate(options):
            option_text = option.get('text', '').lower()
            score = 0
            
            # Check for AWS services mentioned in both option and context
            for keyword in self.aws_keywords:
                if keyword.lower() in option_text and keyword.lower() in context.lower():
                    score += 2
            
            # Check for action keywords
            for action in self.action_keywords:
                if action in option_text and action in context.lower():
                    score += 1
            
            # Check for direct text overlap
            words = option_text.split()
            context_lower = context.lower()
            for word in words:
                if len(word) > 4 and word in context_lower:
                    score += 1
            
            option_scores.append((i, score, option))
        
        # Find best scoring option
        if option_scores:
            option_scores.sort(key=lambda x: x[1], reverse=True)
            best_score = option_scores[0][1]
            
            if best_score > 1:  # Minimum threshold
                best_option = option_scores[0]
                letter = chr(ord('A') + best_option[0])
                
                return {
                    'raw_text': f"{letter}. {best_option[2]['text']}",
                    'clean_text': best_option[2]['text'],
                    'explanation': f"Inferred from context analysis (score: {best_score})",
                    'issues': ['context_inference']
                }
        
        return None
    
    def infer_from_keywords(self, question_text: str, options: List[Dict], context: str) -> Optional[Dict]:
        """Infer answer based on keyword frequency analysis."""
        if not options:
            return None
        
        question_lower = question_text.lower()
        context_lower = context.lower()
        
        option_scores = []
        
        for i, option in enumerate(options):
            option_text = option.get('text', '').lower()
            score = 0
            
            # Score based on keyword overlap with question
            question_words = set(question_lower.split())
            option_words = set(option_text.split())
            common_words = question_words.intersection(option_words)
            
            for word in common_words:
                if len(word) > 3:  # Ignore short words
                    score += 1
            
            # Bonus for AWS service mentions
            aws_in_option = sum(1 for keyword in self.aws_keywords if keyword.lower() in option_text)
            score += aws_in_option * 2
            
            option_scores.append((i, score, option))
        
        if option_scores:
            option_scores.sort(key=lambda x: x[1], reverse=True)
            best_score = option_scores[0][1]
            
            if best_score > 0:  # Any positive score
                best_option = option_scores[0]
                letter = chr(ord('A') + best_option[0])
                
                return {
                    'raw_text': f"{letter}. {best_option[2]['text']}",
                    'clean_text': best_option[2]['text'],
                    'explanation': f"Inferred from keyword analysis (score: {best_score})",
                    'issues': ['keyword_inference']
                }
        
        return None
    
    def extract_answer_letters(self, text: str) -> List[str]:
        """Extract answer letters from text."""
        # Look for letters at start or after common prefixes
        patterns = [
            r'^([A-E])(?:[.\)\:\s]|$)',
            r'(?:Answer|Solution|Correct)[\s:]*([A-E])(?:[.\)\:\s]|$)',
            r'(?:Option|Choice)[\s:]*([A-E])(?:[.\)\:\s]|$)',
            r'\b([A-E])\s+is\s+correct',
            r'([A-E])\s*[,\s]\s*([A-E])',  # Multiple letters
        ]
        
        letters = set()
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                if isinstance(match, tuple):
                    letters.update(m.upper() for m in match if m)
                else:
                    letters.add(match.upper())
        
        # Filter to valid letters
        valid_letters = [l for l in sorted(letters) if 'A' <= l <= 'E']
        return valid_letters[:3]  # Maximum 3 answers
    
    def clean_answer_text(self, text: str) -> str:
        """Clean answer text for processing."""
        # Remove letter prefixes
        text = re.sub(r'^[A-E][.\):;\-\s]*', '', text)
        text = re.sub(r'^Option\s+[A-E][.\):\s]*', '', text, flags=re.IGNORECASE)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        # Extract main content (first sentence or two)
        sentences = re.split(r'(?<=[.!?])\s+', text)
        if sentences and len(sentences[0]) > 15:
            if len(sentences[0]) < 100 and len(sentences) > 1:
                return f"{sentences[0]} {sentences[1]}"
            return sentences[0]
        
        return text[:300]  # Limit length
    
    def calculate_aggressive_confidence(self, answer_data: Dict, context: str, method: str, 
                                      question_text: str, options: List[Dict]) -> float:
        """Calculate confidence score for aggressive extraction."""
        confidence = 0.2  # Base confidence for aggressive parsing
        
        # Method reliability bonus
        method_bonus = {
            'letter_flexible': 0.3,
            'action_based': 0.25,
            'aws_service_based': 0.2,
            'sentence_based': 0.15,
            'line_extraction': 0.1,
            'standalone_action': 0.2,
            'aws_heavy_heuristic': 0.1,
            'answer_indicator': 0.15,
            'option_context': 0.1,
            'context_inference': 0.15,
            'keyword_inference': 0.05
        }
        confidence += method_bonus.get(method, 0)
        
        # Content quality bonus
        answer_text = answer_data.get('clean_text', '')
        
        # Length bonus (reasonable length)
        if 20 <= len(answer_text) <= 200:
            confidence += 0.2
        elif 15 <= len(answer_text) <= 300:
            confidence += 0.1
        
        # AWS keyword bonus
        aws_count = sum(1 for keyword in self.aws_keywords if keyword.lower() in answer_text.lower())
        confidence += min(aws_count * 0.05, 0.15)
        
        # Action word bonus
        action_count = sum(1 for word in self.action_keywords if word in answer_text.lower())
        confidence += min(action_count * 0.03, 0.1)
        
        # Context relevance bonus
        if question_text:
            question_words = set(question_text.lower().split())
            answer_words = set(answer_text.lower().split())
            overlap = len(question_words.intersection(answer_words))
            confidence += min(overlap * 0.02, 0.1)
        
        # Penalties
        if len(answer_text) < 15:
            confidence -= 0.2
        elif len(answer_text) > 500:
            confidence -= 0.1
        
        return min(max(confidence, 0.1), 1.0)  # Keep within bounds
    
    def extract_keywords(self, text: str) -> List[str]:
        """Extract relevant keywords from text."""
        keywords = []
        text_lower = text.lower()
        
        # AWS service keywords
        for keyword in self.aws_keywords:
            if keyword.lower() in text_lower:
                keywords.append(keyword)
        
        # Action keywords
        for action in self.action_keywords:
            if action in text_lower:
                keywords.append(action.title())
        
        return keywords[:10]  # Limit to 10 keywords
    
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
    
    def save_results(self, result: Dict, output_file: str):
        """Save results to file."""
        try:
            output_path = Path(output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
                
            self.logger.info(f"Aggressive parsing results saved to: {output_path}")
            
        except Exception as e:
            self.logger.error(f"Failed to save results: {str(e)}")
            raise


def main():
    """Main entry point for V2 aggressive parser."""
    parser = argparse.ArgumentParser(description='V2 Aggressive parser for remaining unanswered questions')
    parser.add_argument('--pdf', required=True, help='Path to source PDF file')
    parser.add_argument('--enhanced', required=True, help='Path to Phase 2 enhanced results JSON')
    parser.add_argument('--output', required=True, help='Path to save aggressive parsing results')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    
    args = parser.parse_args()
    
    # Validate input files
    if not Path(args.pdf).exists():
        print(f"Error: PDF file not found: {args.pdf}")
        sys.exit(1)
        
    if not Path(args.enhanced).exists():
        print(f"Error: Enhanced file not found: {args.enhanced}")
        sys.exit(1)
    
    try:
        aggressive_parser = V2AggressiveParser(log_level=args.log_level)
        result = aggressive_parser.parse_aggressive(args.pdf, args.enhanced, args.output)
        
        # Print summary
        print(f"\n=== V2 Aggressive Parsing Complete ===")
        print(f"Total questions: {result['metadata']['total_questions']}")
        print(f"Unanswered questions: {result['metadata']['unanswered_questions']}")
        print(f"Aggressive attempts: {result['metadata']['aggressive_attempts']}")
        print(f"Aggressive successes: {result['metadata']['aggressive_successes']}")
        print(f"Success rate: {result['metadata']['aggressive_success_rate']:.1f}%")
        print(f"Additional coverage: +{result['metadata']['additional_coverage_percent']:.1f}%")
        
        if result['metadata']['pattern_usage']:
            print(f"\nPattern usage:")
            for pattern, count in result['metadata']['pattern_usage'].items():
                print(f"  {pattern}: {count} extractions")
        
        print(f"\nConfidence distribution:")
        conf_dist = result['metadata']['confidence_distribution']
        print(f"  High (≥0.7): {conf_dist['high']}")
        print(f"  Medium (0.5-0.7): {conf_dist['medium']}")
        print(f"  Low (<0.5): {conf_dist['low']}")
        
        print(f"\nQuestions requiring AI completion: {result['parsing_report']['requires_ai_completion']}")
        print(f"Output saved to: {args.output}")
        
    except Exception as e:
        print(f"V2 Aggressive parsing failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()