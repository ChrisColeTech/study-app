#!/usr/bin/env python3
"""
Phase 2.2: Segment Classification Tool

Classifies answer segments into categories:
- Empty: Just question number with no content
- Content: Has meaningful content but unparseable  
- Parseable: Already successfully parsed

This helps determine what tools to apply to each segment type.

Usage:
    python segment_classifier.py --source "docs/exam-material/AWS SAA-03 Solution.txt" --answers data/answers_enhanced.json --output data/segment_analysis.json
"""

import re
import json
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set
import sys


class SegmentClassifier:
    """Classify answer segments by type and content."""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize segment classifier with logging."""
        self.setup_logging(log_level)
        
        self.stats = {
            'total_pdf_questions': 681,
            'total_source_segments': 0,
            'parsed_segments': 0,
            'empty_segments': 0,
            'content_segments': 0,
            'missing_from_source': 0,
            'categories': {
                'parsed': [],           # Successfully extracted
                'empty': [],            # Just question number
                'has_content': [],      # Content but unparseable
                'missing': []           # Not in source file
            }
        }
    
    def setup_logging(self, level: str):
        """Configure logging."""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"segment_classifier_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def classify_segments(self, source_file: str, answers_file: str, output_file: str) -> Dict:
        """
        Classify all segments into categories.
        
        Args:
            source_file: Path to source text file
            answers_file: Path to extracted answers JSON
            output_file: Path to save classification results
            
        Returns:
            Classification results dictionary
        """
        self.logger.info(f"Loading source file: {source_file}")
        
        # Load source text
        try:
            with open(source_file, 'r', encoding='utf-8', errors='replace') as f:
                source_content = f.read()
        except Exception as e:
            self.logger.error(f"Failed to load source file: {str(e)}")
            raise
        
        # Load extracted answers
        self.logger.info(f"Loading extracted answers: {answers_file}")
        try:
            with open(answers_file, 'r', encoding='utf-8') as f:
                answers_data = json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load answers file: {str(e)}")
            raise
        
        # Get successfully parsed answer numbers
        parsed_numbers = set(ans['answer_number'] for ans in answers_data['answers'])
        self.stats['parsed_segments'] = len(parsed_numbers)
        
        # Extract all question segments from source
        source_segments = self.extract_all_segments(source_content)
        self.stats['total_source_segments'] = len(source_segments)
        
        # Get all question numbers that should exist (1-681)
        all_pdf_questions = set(range(1, 682))
        source_numbers = set(source_segments.keys())
        
        # Classify segments
        self.logger.info("Classifying segments...")
        
        # 1. Successfully parsed segments
        self.stats['categories']['parsed'] = sorted(list(parsed_numbers))
        
        # 2. Missing from source entirely
        missing_numbers = all_pdf_questions - source_numbers
        self.stats['categories']['missing'] = sorted(list(missing_numbers))
        self.stats['missing_from_source'] = len(missing_numbers)
        
        # 3. Available in source but not parsed - classify as empty or has_content
        unparsed_numbers = source_numbers - parsed_numbers
        
        for num in unparsed_numbers:
            segment_content = source_segments[num]
            if self.is_empty_segment(segment_content):
                self.stats['categories']['empty'].append(num)
            else:
                self.stats['categories']['has_content'].append(num)
        
        # Sort lists
        self.stats['categories']['empty'].sort()
        self.stats['categories']['has_content'].sort()
        
        # Update stats
        self.stats['empty_segments'] = len(self.stats['categories']['empty'])
        self.stats['content_segments'] = len(self.stats['categories']['has_content'])
        
        # Generate detailed analysis
        detailed_analysis = self.generate_detailed_analysis(source_segments, parsed_numbers)
        
        # Create result structure
        result = {
            'metadata': {
                'classification_date': datetime.now().isoformat(),
                'source_file': source_file,
                'answers_file': answers_file,
                'total_pdf_questions': self.stats['total_pdf_questions'],
                'total_source_segments': self.stats['total_source_segments'],
                'coverage_statistics': {
                    'parsed_successfully': self.stats['parsed_segments'],
                    'empty_segments': self.stats['empty_segments'],
                    'content_segments': self.stats['content_segments'], 
                    'missing_from_source': self.stats['missing_from_source']
                },
                'percentages': {
                    'parsed_rate': round(self.stats['parsed_segments'] / self.stats['total_pdf_questions'] * 100, 1),
                    'source_coverage': round(self.stats['total_source_segments'] / self.stats['total_pdf_questions'] * 100, 1),
                    'empty_rate': round(self.stats['empty_segments'] / self.stats['total_source_segments'] * 100, 1) if self.stats['total_source_segments'] > 0 else 0,
                    'extractable_rate': round(self.stats['content_segments'] / self.stats['total_source_segments'] * 100, 1) if self.stats['total_source_segments'] > 0 else 0
                }
            },
            'categories': self.stats['categories'],
            'detailed_analysis': detailed_analysis,
            'recommendations': self.generate_recommendations()
        }
        
        # Save results
        try:
            output_path = Path(output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
                
            self.logger.info(f"Classification results saved to: {output_path}")
            
        except Exception as e:
            self.logger.error(f"Failed to save classification results: {str(e)}")
            raise
        
        return result
    
    def extract_all_segments(self, source_content: str) -> Dict[int, str]:
        """Extract all question segments from source content."""
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
    
    def is_empty_segment(self, segment_content: str) -> bool:
        """Determine if a segment is effectively empty."""
        # Remove question number and common separators
        cleaned = re.sub(r'^\d+\]', '', segment_content)
        cleaned = re.sub(r'[-=]{3,}', '', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned)
        cleaned = cleaned.strip()
        
        # Consider empty if less than 50 characters of meaningful content
        return len(cleaned) < 50
    
    def generate_detailed_analysis(self, source_segments: Dict[int, str], parsed_numbers: Set[int]) -> Dict:
        """Generate detailed analysis of segments."""
        analysis = {
            'empty_segment_examples': [],
            'content_segment_examples': [],
            'missing_ranges': [],
            'parsing_issues': []
        }
        
        # Sample empty segments
        empty_nums = self.stats['categories']['empty'][:5]
        for num in empty_nums:
            preview = source_segments[num][:200] + "..." if len(source_segments[num]) > 200 else source_segments[num]
            analysis['empty_segment_examples'].append({
                'question_number': num,
                'content_preview': preview,
                'length': len(source_segments[num])
            })
        
        # Sample content segments that need parsing
        content_nums = self.stats['categories']['has_content'][:5]
        for num in content_nums:
            preview = source_segments[num][:300] + "..." if len(source_segments[num]) > 300 else source_segments[num]
            analysis['content_segment_examples'].append({
                'question_number': num,
                'content_preview': preview,
                'length': len(source_segments[num]),
                'potential_patterns': self.identify_potential_patterns(source_segments[num])
            })
        
        # Identify missing ranges
        missing_list = sorted(self.stats['categories']['missing'])
        if missing_list:
            ranges = []
            start = missing_list[0]
            for i in range(1, len(missing_list)):
                if missing_list[i] != missing_list[i-1] + 1:
                    if start == missing_list[i-1]:
                        ranges.append(str(start))
                    else:
                        ranges.append(f"{start}-{missing_list[i-1]}")
                    start = missing_list[i]
            
            # Add final range
            if start == missing_list[-1]:
                ranges.append(str(start))
            else:
                ranges.append(f"{start}-{missing_list[-1]}")
            
            analysis['missing_ranges'] = ranges[:10]  # First 10 ranges
        
        return analysis
    
    def identify_potential_patterns(self, segment_content: str) -> List[str]:
        """Identify potential answer patterns in content."""
        patterns = []
        
        # Check for various answer formats
        if re.search(r'[A-E]\s+[A-Z]', segment_content):
            patterns.append("letter_space_format")
        if re.search(r'[A-E]\)[^A-E]*[A-Z]', segment_content):
            patterns.append("letter_parenthesis_format")
        if re.search(r'Option\s+[A-E]', segment_content, re.IGNORECASE):
            patterns.append("option_format")
        if re.search(r'(Create|Use|Configure|Set up|Enable)', segment_content):
            patterns.append("aws_service_actions")
        if re.search(r'(Amazon|AWS)\s+\w+', segment_content):
            patterns.append("aws_services_mentioned")
        
        return patterns
    
    def generate_recommendations(self) -> Dict:
        """Generate recommendations for next steps."""
        recommendations = {
            'immediate_actions': [],
            'tool_priorities': [],
            'expected_improvements': {}
        }
        
        # Immediate actions based on classification
        if self.stats['content_segments'] > 0:
            recommendations['immediate_actions'].append(
                f"Create aggressive parser for {self.stats['content_segments']} segments with content"
            )
        
        if self.stats['empty_segments'] > 0:
            recommendations['immediate_actions'].append(
                f"Document {self.stats['empty_segments']} empty segments as unsalvageable"
            )
        
        if self.stats['missing_from_source'] > 0:
            recommendations['immediate_actions'].append(
                f"Research alternative sources for {self.stats['missing_from_source']} missing questions"
            )
        
        # Tool priorities
        if self.stats['content_segments'] > 10:
            recommendations['tool_priorities'].append("High: Aggressive answer parser")
        if self.stats['missing_from_source'] > 50:
            recommendations['tool_priorities'].append("Medium: Alternative source research")
        recommendations['tool_priorities'].append("Low: Manual answer creation")
        
        # Expected improvements
        potential_additional = self.stats['content_segments']
        current_coverage = self.stats['parsed_segments'] / self.stats['total_pdf_questions'] * 100
        max_possible = (self.stats['parsed_segments'] + potential_additional) / self.stats['total_pdf_questions'] * 100
        
        recommendations['expected_improvements'] = {
            'current_coverage': f"{current_coverage:.1f}%",
            'max_possible_coverage': f"{max_possible:.1f}%",
            'potential_additional_answers': potential_additional,
            'permanently_missing': self.stats['missing_from_source'] + self.stats['empty_segments']
        }
        
        return recommendations


def main():
    """Main entry point for segment classifier."""
    parser = argparse.ArgumentParser(description='Classify answer segments by type and content')
    parser.add_argument('--source', required=True, help='Path to source text file')
    parser.add_argument('--answers', required=True, help='Path to extracted answers JSON file') 
    parser.add_argument('--output', required=True, help='Path to save classification results')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    
    args = parser.parse_args()
    
    # Validate input files
    if not Path(args.source).exists():
        print(f"Error: Source file not found: {args.source}")
        sys.exit(1)
        
    if not Path(args.answers).exists():
        print(f"Error: Answers file not found: {args.answers}")
        sys.exit(1)
    
    try:
        classifier = SegmentClassifier(log_level=args.log_level)
        result = classifier.classify_segments(args.source, args.answers, args.output)
        
        # Print summary
        print(f"\n=== Segment Classification Complete ===")
        print(f"Total PDF questions: {result['metadata']['total_pdf_questions']}")
        print(f"Source segments found: {result['metadata']['total_source_segments']}")
        print(f"Successfully parsed: {len(result['categories']['parsed'])}")
        print(f"Empty segments: {len(result['categories']['empty'])}")
        print(f"Content segments (unparsed): {len(result['categories']['has_content'])}")
        print(f"Missing from source: {len(result['categories']['missing'])}")
        
        print(f"\nCoverage Statistics:")
        print(f"  Parsed rate: {result['metadata']['percentages']['parsed_rate']}%")
        print(f"  Source coverage: {result['metadata']['percentages']['source_coverage']}%")
        print(f"  Empty rate: {result['metadata']['percentages']['empty_rate']}%")
        print(f"  Extractable rate: {result['metadata']['percentages']['extractable_rate']}%")
        
        if result['categories']['has_content']:
            print(f"\nContent segments to target: {result['categories']['has_content'][:10]}")
        
        print(f"\nOutput saved to: {args.output}")
        
    except Exception as e:
        print(f"Classification failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()