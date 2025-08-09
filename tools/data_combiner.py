#!/usr/bin/env python3
"""
Phase 2.4: Data Combiner Tool

Combines answers from multiple parsing stages into a final unified dataset
ready for the mobile study application.

Usage:
    python data_combiner.py --enhanced data/answers_enhanced.json --aggressive data/answers_aggressive.json --questions data/questions_classified.json --output data/study_data_final.json
"""

import json
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
import sys


class DataCombiner:
    """Combine multiple answer sources into final study dataset."""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize data combiner with logging."""
        self.setup_logging(log_level)
        
        self.stats = {
            'questions_loaded': 0,
            'enhanced_answers': 0,
            'aggressive_answers': 0,
            'total_combined': 0,
            'matched_pairs': 0,
            'unmatched_questions': 0,
            'duplicate_answers': 0,
            'data_quality': {
                'high_confidence': 0,
                'medium_confidence': 0,
                'low_confidence': 0,
                'missing_explanations': 0
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
                logging.FileHandler(log_dir / f"data_combiner_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def combine_data(self, enhanced_file: str, aggressive_file: str, questions_file: str, output_file: str) -> Dict:
        """
        Combine all data sources into final study dataset.
        
        Args:
            enhanced_file: Path to enhanced answers JSON
            aggressive_file: Path to aggressive answers JSON  
            questions_file: Path to classified questions JSON
            output_file: Path to save final combined dataset
            
        Returns:
            Combined dataset dictionary
        """
        self.logger.info("Loading all data sources...")
        
        # Load questions
        questions_data = self.load_json_file(questions_file, "questions")
        questions = questions_data['questions']
        self.stats['questions_loaded'] = len(questions)
        
        # Load enhanced answers
        enhanced_data = self.load_json_file(enhanced_file, "enhanced answers")
        enhanced_answers = enhanced_data['answers']
        self.stats['enhanced_answers'] = len(enhanced_answers)
        
        # Load aggressive answers
        aggressive_data = self.load_json_file(aggressive_file, "aggressive answers")
        aggressive_answers = aggressive_data['answers']
        self.stats['aggressive_answers'] = len(aggressive_answers)
        
        # Combine answers
        self.logger.info("Combining answer sources...")
        combined_answers = self.merge_answer_sources(enhanced_answers, aggressive_answers)
        
        # Match questions with answers
        self.logger.info("Matching questions with answers...")
        study_pairs = self.match_questions_answers(questions, combined_answers)
        
        # Generate final dataset
        final_dataset = self.create_final_dataset(
            study_pairs, questions_data, enhanced_data, aggressive_data
        )
        
        # Save results
        self.save_final_dataset(final_dataset, output_file)
        
        return final_dataset
    
    def load_json_file(self, file_path: str, description: str) -> Dict:
        """Load and validate JSON file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.logger.info(f"Loaded {description}: {file_path}")
            return data
        except Exception as e:
            self.logger.error(f"Failed to load {description} from {file_path}: {str(e)}")
            raise
    
    def merge_answer_sources(self, enhanced_answers: List[Dict], aggressive_answers: List[Dict]) -> Dict[int, Dict]:
        """Merge enhanced and aggressive answer sources."""
        combined = {}
        
        # Add enhanced answers
        for answer in enhanced_answers:
            answer_num = answer['answer_number']
            answer['source'] = 'enhanced'
            combined[answer_num] = answer
        
        # Add aggressive answers (check for duplicates)
        for answer in aggressive_answers:
            answer_num = answer['answer_number']
            if answer_num in combined:
                self.stats['duplicate_answers'] += 1
                self.logger.warning(f"Duplicate answer found for question {answer_num} - keeping enhanced version")
            else:
                answer['source'] = 'aggressive'
                combined[answer_num] = answer
        
        self.stats['total_combined'] = len(combined)
        self.logger.info(f"Combined {len(combined)} unique answers from both sources")
        
        return combined
    
    def match_questions_answers(self, questions: List[Dict], answers: Dict[int, Dict]) -> List[Dict]:
        """Match questions with their corresponding answers."""
        study_pairs = []
        
        for question in questions:
            question_num = question['question_number']
            
            if question_num in answers:
                # Create matched pair
                answer = answers[question_num]
                study_pair = self.create_study_pair(question, answer)
                study_pairs.append(study_pair)
                self.stats['matched_pairs'] += 1
                
                # Track quality statistics
                self.track_quality_stats(answer)
                
            else:
                # Create question-only entry
                study_pair = self.create_question_only_pair(question)
                study_pairs.append(study_pair)
                self.stats['unmatched_questions'] += 1
        
        return study_pairs
    
    def create_study_pair(self, question: Dict, answer: Dict) -> Dict:
        """Create a complete question-answer study pair."""
        return {
            'question_number': question['question_number'],
            'question': {
                'text': question['question_text'],
                'options': question['options'],
                'question_type': question['question_type'],
                'expected_answers': question.get('select_count', 1),
                'topic': question.get('topic_name', 'Unknown'),
                'service_category': question.get('topic_name', 'Unknown'),
                'aws_services': question.get('detected_services', [])
            },
            'answer': {
                'correct_answer': answer['correct_answer'],
                'explanation': answer.get('explanation', ''),
                'keywords': answer.get('keywords', []),
                'parsing_confidence': answer.get('parsing_confidence', 0.0),
                'source': answer.get('source', 'unknown')
            },
            'study_metadata': {
                'difficulty': self.assess_difficulty(question, answer),
                'completeness': self.assess_completeness(answer),
                'question_preview': answer.get('question_preview', ''),
                'has_explanation': bool(answer.get('explanation', '').strip()),
                'confidence_level': self.categorize_confidence(answer.get('parsing_confidence', 0))
            }
        }
    
    def create_question_only_pair(self, question: Dict) -> Dict:
        """Create a question-only pair for questions without answers."""
        return {
            'question_number': question['question_number'],
            'question': {
                'text': question['question_text'],
                'options': question['options'],
                'question_type': question['question_type'],
                'expected_answers': question.get('select_count', 1),
                'topic': question.get('topic_name', 'Unknown'),
                'service_category': question.get('topic_name', 'Unknown'),
                'aws_services': question.get('detected_services', [])
            },
            'answer': None,
            'study_metadata': {
                'difficulty': 'unknown',
                'completeness': 'incomplete',
                'question_preview': question['question_text'][:200] + "..." if len(question['question_text']) > 200 else question['question_text'],
                'has_explanation': False,
                'confidence_level': 'missing'
            }
        }
    
    def assess_difficulty(self, question: Dict, answer: Dict) -> str:
        """Assess difficulty level based on question and answer characteristics."""
        difficulty_score = 0
        
        # Question type difficulty
        if question['question_type'] == 'multiple_choice_3':
            difficulty_score += 3
        elif question['question_type'] == 'multiple_choice_2':
            difficulty_score += 2
        else:
            difficulty_score += 1
        
        # Answer complexity (length and AWS service count)
        answer_text = answer.get('correct_answer', '')
        if len(answer_text) > 150:
            difficulty_score += 1
        
        aws_services = answer.get('keywords', [])
        if len(aws_services) >= 3:
            difficulty_score += 1
        elif len(aws_services) >= 2:
            difficulty_score += 0.5
        
        # Confidence penalty (lower confidence = higher difficulty)
        confidence = answer.get('parsing_confidence', 0.5)
        if confidence < 0.6:
            difficulty_score += 1
        
        if difficulty_score >= 4:
            return 'hard'
        elif difficulty_score >= 2.5:
            return 'medium'
        else:
            return 'easy'
    
    def assess_completeness(self, answer: Dict) -> str:
        """Assess completeness of answer data."""
        score = 0
        max_score = 4
        
        if answer.get('correct_answer', '').strip():
            score += 1
        if answer.get('explanation', '').strip():
            score += 1
        if answer.get('keywords', []):
            score += 1
        if answer.get('parsing_confidence', 0) >= 0.5:
            score += 1
        
        completeness_ratio = score / max_score
        
        if completeness_ratio >= 0.8:
            return 'complete'
        elif completeness_ratio >= 0.5:
            return 'partial'
        else:
            return 'minimal'
    
    def categorize_confidence(self, confidence: float) -> str:
        """Categorize parsing confidence level."""
        if confidence >= 0.8:
            return 'high'
        elif confidence >= 0.6:
            return 'medium'
        elif confidence >= 0.4:
            return 'low'
        else:
            return 'very_low'
    
    def track_quality_stats(self, answer: Dict):
        """Track quality statistics for answers."""
        confidence = answer.get('parsing_confidence', 0.0)
        
        if confidence >= 0.7:
            self.stats['data_quality']['high_confidence'] += 1
        elif confidence >= 0.5:
            self.stats['data_quality']['medium_confidence'] += 1
        else:
            self.stats['data_quality']['low_confidence'] += 1
        
        if not answer.get('explanation', '').strip():
            self.stats['data_quality']['missing_explanations'] += 1
    
    def create_final_dataset(self, study_pairs: List[Dict], questions_data: Dict, 
                           enhanced_data: Dict, aggressive_data: Dict) -> Dict:
        """Create the final study dataset."""
        
        # Sort study pairs by question number
        study_pairs.sort(key=lambda x: x['question_number'])
        
        # Generate comprehensive statistics
        coverage_stats = self.calculate_coverage_statistics(study_pairs)
        quality_stats = self.calculate_quality_statistics(study_pairs)
        topic_stats = self.calculate_topic_statistics(study_pairs)
        
        # Create final dataset structure
        final_dataset = {
            'metadata': {
                'creation_date': datetime.now().isoformat(),
                'version': '1.0',
                'description': 'AWS SAA-C03 Study Dataset - Combined from PDF questions and text answers',
                'total_questions': len(study_pairs),
                'answered_questions': self.stats['matched_pairs'],
                'coverage_percentage': round((self.stats['matched_pairs'] / len(study_pairs)) * 100, 1),
                'data_sources': {
                    'questions_source': 'AWS SAA-C03 PDF (681 questions)',
                    'enhanced_answers': f"{self.stats['enhanced_answers']} answers",
                    'aggressive_answers': f"{self.stats['aggressive_answers']} answers"
                },
                'processing_stats': self.stats,
                'coverage_statistics': coverage_stats,
                'quality_statistics': quality_stats,
                'topic_statistics': topic_stats
            },
            'study_data': study_pairs,
            'topics': self.extract_topic_definitions(questions_data),
            'study_recommendations': self.generate_study_recommendations(study_pairs)
        }
        
        return final_dataset
    
    def calculate_coverage_statistics(self, study_pairs: List[Dict]) -> Dict:
        """Calculate detailed coverage statistics."""
        total = len(study_pairs)
        answered = sum(1 for pair in study_pairs if pair['answer'] is not None)
        
        return {
            'total_questions': total,
            'answered_questions': answered,
            'unanswered_questions': total - answered,
            'coverage_percentage': round((answered / total) * 100, 1),
            'completeness_breakdown': {
                'complete': sum(1 for pair in study_pairs if pair['answer'] and pair['study_metadata']['completeness'] == 'complete'),
                'partial': sum(1 for pair in study_pairs if pair['answer'] and pair['study_metadata']['completeness'] == 'partial'),
                'minimal': sum(1 for pair in study_pairs if pair['answer'] and pair['study_metadata']['completeness'] == 'minimal')
            }
        }
    
    def calculate_quality_statistics(self, study_pairs: List[Dict]) -> Dict:
        """Calculate quality statistics."""
        answered_pairs = [pair for pair in study_pairs if pair['answer'] is not None]
        
        if not answered_pairs:
            return {'no_answered_questions': True}
        
        confidence_dist = {}
        difficulty_dist = {}
        has_explanation = 0
        
        for pair in answered_pairs:
            # Confidence distribution
            conf_level = pair['study_metadata']['confidence_level']
            confidence_dist[conf_level] = confidence_dist.get(conf_level, 0) + 1
            
            # Difficulty distribution
            difficulty = pair['study_metadata']['difficulty']
            difficulty_dist[difficulty] = difficulty_dist.get(difficulty, 0) + 1
            
            # Explanation availability
            if pair['study_metadata']['has_explanation']:
                has_explanation += 1
        
        return {
            'confidence_distribution': confidence_dist,
            'difficulty_distribution': difficulty_dist,
            'explanation_coverage': {
                'with_explanations': has_explanation,
                'without_explanations': len(answered_pairs) - has_explanation,
                'explanation_rate': round((has_explanation / len(answered_pairs)) * 100, 1)
            }
        }
    
    def calculate_topic_statistics(self, study_pairs: List[Dict]) -> Dict:
        """Calculate topic-wise statistics."""
        topic_stats = {}
        
        for pair in study_pairs:
            topic = pair['question']['topic']
            if topic not in topic_stats:
                topic_stats[topic] = {
                    'total_questions': 0,
                    'answered_questions': 0,
                    'coverage_percentage': 0
                }
            
            topic_stats[topic]['total_questions'] += 1
            if pair['answer'] is not None:
                topic_stats[topic]['answered_questions'] += 1
        
        # Calculate coverage percentages
        for topic, stats in topic_stats.items():
            if stats['total_questions'] > 0:
                stats['coverage_percentage'] = round(
                    (stats['answered_questions'] / stats['total_questions']) * 100, 1
                )
        
        return topic_stats
    
    def extract_topic_definitions(self, questions_data: Dict) -> Dict:
        """Extract topic definitions from questions data."""
        return questions_data.get('topic_definitions', {})
    
    def generate_study_recommendations(self, study_pairs: List[Dict]) -> Dict:
        """Generate study recommendations based on data quality."""
        answered_pairs = [pair for pair in study_pairs if pair['answer'] is not None]
        
        recommendations = {
            'study_approach': [],
            'focus_areas': [],
            'data_limitations': []
        }
        
        if len(answered_pairs) >= 500:
            recommendations['study_approach'].append("Comprehensive study possible with 500+ questions")
        elif len(answered_pairs) >= 300:
            recommendations['study_approach'].append("Good coverage for focused study sessions")
        else:
            recommendations['study_approach'].append("Limited coverage - supplement with additional resources")
        
        # Topic recommendations based on coverage
        topic_coverage = self.calculate_topic_statistics(study_pairs)
        low_coverage_topics = [
            topic for topic, stats in topic_coverage.items() 
            if stats['coverage_percentage'] < 60
        ]
        
        if low_coverage_topics:
            recommendations['focus_areas'].extend([
                f"Low coverage in {topic}: {topic_coverage[topic]['coverage_percentage']:.1f}%" 
                for topic in low_coverage_topics[:3]
            ])
        
        # Data limitations
        missing_answers = len(study_pairs) - len(answered_pairs)
        if missing_answers > 100:
            recommendations['data_limitations'].append(
                f"{missing_answers} questions lack answers - consider finding additional sources"
            )
        
        return recommendations
    
    def save_final_dataset(self, dataset: Dict, output_file: str):
        """Save final dataset to file."""
        try:
            output_path = Path(output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(dataset, f, indent=2, ensure_ascii=False)
                
            self.logger.info(f"Final dataset saved to: {output_path}")
            
        except Exception as e:
            self.logger.error(f"Failed to save final dataset: {str(e)}")
            raise


def main():
    """Main entry point for data combiner."""
    parser = argparse.ArgumentParser(description='Combine multiple answer sources into final study dataset')
    parser.add_argument('--enhanced', required=True, help='Path to enhanced answers JSON file')
    parser.add_argument('--aggressive', required=True, help='Path to aggressive answers JSON file') 
    parser.add_argument('--questions', required=True, help='Path to classified questions JSON file')
    parser.add_argument('--output', required=True, help='Path to save final combined dataset')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    
    args = parser.parse_args()
    
    # Validate input files
    for file_path, description in [
        (args.enhanced, 'Enhanced answers file'),
        (args.aggressive, 'Aggressive answers file'),
        (args.questions, 'Questions file')
    ]:
        if not Path(file_path).exists():
            print(f"Error: {description} not found: {file_path}")
            sys.exit(1)
    
    try:
        combiner = DataCombiner(log_level=args.log_level)
        result = combiner.combine_data(args.enhanced, args.aggressive, args.questions, args.output)
        
        # Print comprehensive summary
        metadata = result['metadata']
        print(f"\n=== Data Combination Complete ===")
        print(f"Total questions: {metadata['total_questions']}")
        print(f"Answered questions: {metadata['answered_questions']}")
        print(f"Coverage: {metadata['coverage_percentage']}%")
        
        print(f"\nData Sources:")
        for source, count in metadata['data_sources'].items():
            print(f"  {source}: {count}")
        
        print(f"\nQuality Statistics:")
        quality = metadata['quality_statistics']
        if 'explanation_coverage' in quality:
            print(f"  With explanations: {quality['explanation_coverage']['with_explanations']} ({quality['explanation_coverage']['explanation_rate']}%)")
        
        if 'confidence_distribution' in quality:
            print(f"  Confidence levels:")
            for level, count in quality['confidence_distribution'].items():
                print(f"    {level}: {count}")
        
        print(f"\nTop Topics by Coverage:")
        topic_stats = metadata['topic_statistics']
        sorted_topics = sorted(
            topic_stats.items(), 
            key=lambda x: x[1]['coverage_percentage'], 
            reverse=True
        )
        for topic, stats in sorted_topics[:5]:
            print(f"  {topic}: {stats['answered_questions']}/{stats['total_questions']} ({stats['coverage_percentage']}%)")
        
        print(f"\nOutput saved to: {args.output}")
        
    except Exception as e:
        print(f"Data combination failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()