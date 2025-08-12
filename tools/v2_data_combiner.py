#!/usr/bin/env python3
"""
Phase 4: V2 Data Combiner Tool

Combines V2 classified questions with enhanced and aggressive answers into final unified datasets
ready for mobile study application. Processes all 7 PDFs through final combination phase.

Usage:
    python v2_data_combiner.py --pdf clf-c02_2
    python v2_data_combiner.py --pdf sap-c02_6
    python v2_data_combiner.py --all
"""

import json
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
import sys


class V2DataCombiner:
    """Combine V2 classified questions with enhanced and aggressive answers into final study datasets."""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize V2 data combiner with logging."""
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
        
        # Define all 7 PDFs to process
        self.pdf_list = [
            'clf-c02_2',
            'clf-c02_6', 
            'sap-c02_6',
            'sap-c02_7',
            'sap-c02_8',
            'aif-c01_3',
            'aif-c01_6'
        ]
    
    def setup_logging(self, level: str):
        """Configure logging."""
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"v2_data_combiner_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def combine_pdf_data(self, pdf_name: str) -> Dict:
        """
        Combine all data sources for a single PDF into final study dataset.
        
        Args:
            pdf_name: Name of PDF to process (e.g., 'clf-c02_2')
            
        Returns:
            Combined dataset dictionary
        """
        self.logger.info(f"Processing PDF: {pdf_name}")
        
        # Reset stats for this PDF
        self.reset_stats()
        
        # Define file paths
        v2_dir = Path(__file__).parent.parent / "data" / "v2"
        data_dir = Path(__file__).parent.parent / "data"
        
        classified_file = v2_dir / f"{pdf_name}_classified.json"
        enhanced_file = v2_dir / f"{pdf_name}_enhanced.json"
        aggressive_file = v2_dir / f"{pdf_name}_aggressive.json"
        output_file = data_dir / f"{pdf_name}_study_data.json"
        
        # Validate input files exist
        for file_path, description in [
            (classified_file, 'Classified questions file'),
            (enhanced_file, 'Enhanced answers file'),
            (aggressive_file, 'Aggressive answers file')
        ]:
            if not file_path.exists():
                self.logger.error(f"{description} not found: {file_path}")
                raise FileNotFoundError(f"{description} not found: {file_path}")
        
        self.logger.info("Loading all data sources...")
        
        # Load classified questions
        questions_data = self.load_json_file(str(classified_file), "classified questions")
        questions = questions_data['questions']
        self.stats['questions_loaded'] = len(questions)
        
        # Load enhanced answers
        enhanced_data = self.load_json_file(str(enhanced_file), "enhanced answers")
        enhanced_answers = enhanced_data['answers']
        self.stats['enhanced_answers'] = len(enhanced_answers)
        
        # Load aggressive answers
        aggressive_data = self.load_json_file(str(aggressive_file), "aggressive answers")
        aggressive_answers = aggressive_data.get('aggressive_answers', aggressive_data.get('answers', []))
        self.stats['aggressive_answers'] = len(aggressive_answers)
        
        # Combine answers
        self.logger.info("Combining answer sources...")
        combined_answers = self.merge_answer_sources(enhanced_answers, aggressive_answers)
        
        # Match questions with answers
        self.logger.info("Matching questions with answers...")
        study_pairs = self.match_questions_answers(questions, combined_answers)
        
        # Generate final dataset
        final_dataset = self.create_final_dataset(
            study_pairs, questions_data, enhanced_data, aggressive_data, pdf_name
        )
        
        # Save results
        self.save_final_dataset(final_dataset, str(output_file))
        
        return final_dataset
    
    def reset_stats(self):
        """Reset statistics for new PDF processing."""
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
            answer_num = answer.get('question_number', answer.get('answer_number', 0))
            answer['source'] = 'enhanced'
            combined[answer_num] = answer
        
        # Add aggressive answers (check for duplicates)
        for answer in aggressive_answers:
            answer_num = answer.get('question_number', answer.get('answer_number', 0))
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
                'correct_answer': answer.get('correct_answers', answer.get('correct_answer', [])),
                'explanation': answer.get('explanation', ''),
                'keywords': answer.get('keywords', []),
                'parsing_confidence': answer.get('validation_confidence', answer.get('parsing_confidence', 0.0)),
                'source': answer.get('source', 'unknown')
            },
            'study_metadata': {
                'difficulty': self.assess_difficulty(question, answer),
                'completeness': self.assess_completeness(answer),
                'question_preview': answer.get('question_preview', answer.get('raw_answer_text', '')),
                'has_explanation': bool(answer.get('explanation', '').strip()),
                'confidence_level': self.categorize_confidence(answer.get('validation_confidence', answer.get('parsing_confidence', 0)))
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
        answer_text = str(answer.get('correct_answers', answer.get('correct_answer', '')))
        if len(answer_text) > 150:
            difficulty_score += 1
        
        aws_services = answer.get('keywords', [])
        if len(aws_services) >= 3:
            difficulty_score += 1
        elif len(aws_services) >= 2:
            difficulty_score += 0.5
        
        # Confidence penalty (lower confidence = higher difficulty)
        confidence = answer.get('validation_confidence', answer.get('parsing_confidence', 0.5))
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
        
        if answer.get('correct_answers', answer.get('correct_answer', [])):
            score += 1
        if answer.get('explanation', '').strip():
            score += 1
        if answer.get('keywords', []):
            score += 1
        if answer.get('validation_confidence', answer.get('parsing_confidence', 0)) >= 0.5:
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
        confidence = answer.get('validation_confidence', answer.get('parsing_confidence', 0.0))
        
        if confidence >= 0.7:
            self.stats['data_quality']['high_confidence'] += 1
        elif confidence >= 0.5:
            self.stats['data_quality']['medium_confidence'] += 1
        else:
            self.stats['data_quality']['low_confidence'] += 1
        
        if not answer.get('explanation', '').strip():
            self.stats['data_quality']['missing_explanations'] += 1
    
    def create_final_dataset(self, study_pairs: List[Dict], questions_data: Dict, 
                           enhanced_data: Dict, aggressive_data: Dict, pdf_name: str) -> Dict:
        """Create the final study dataset."""
        
        # Sort study pairs by question number
        study_pairs.sort(key=lambda x: x['question_number'])
        
        # Generate comprehensive statistics
        coverage_stats = self.calculate_coverage_statistics(study_pairs)
        quality_stats = self.calculate_quality_statistics(study_pairs)
        topic_stats = self.calculate_topic_statistics(study_pairs)
        
        # Extract exam details from PDF name
        exam_details = self.extract_exam_details(pdf_name, questions_data)
        
        # Create final dataset structure (identical to V1 format)
        final_dataset = {
            'metadata': {
                'creation_date': datetime.now().isoformat(),
                'version': '2.0',
                'description': f'{exam_details["exam_name"]} Study Dataset - Combined from PDF questions and text answers',
                'total_questions': len(study_pairs),
                'answered_questions': self.stats['matched_pairs'],
                'coverage_percentage': round((self.stats['matched_pairs'] / len(study_pairs)) * 100, 1) if len(study_pairs) > 0 else 0,
                'data_sources': {
                    'questions_source': f'{exam_details["exam_name"]} PDF ({len(study_pairs)} questions)',
                    'enhanced_answers': f"{self.stats['enhanced_answers']} answers",
                    'aggressive_answers': f"{self.stats['aggressive_answers']} answers"
                },
                'processing_stats': self.stats.copy(),
                'coverage_statistics': coverage_stats,
                'quality_statistics': quality_stats,
                'topic_statistics': topic_stats
            },
            'study_data': study_pairs,
            'topics': self.extract_topic_definitions(questions_data),
            'study_recommendations': self.generate_study_recommendations(study_pairs)
        }
        
        return final_dataset
    
    def extract_exam_details(self, pdf_name: str, questions_data: Dict) -> Dict:
        """Extract exam details from PDF name and questions data."""
        exam_mapping = {
            'clf-c02': 'AWS Certified Cloud Practitioner CLF-C02',
            'sap-c02': 'AWS Certified Solutions Architect Professional SAP-C02',
            'aif-c01': 'AWS Certified AI Practitioner AIF-C01'
        }
        
        exam_code = pdf_name.split('_')[0]
        exam_name = exam_mapping.get(exam_code, f'{exam_code.upper()} Exam')
        
        return {
            'exam_code': exam_code,
            'exam_name': exam_name,
            'pdf_name': pdf_name
        }
    
    def calculate_coverage_statistics(self, study_pairs: List[Dict]) -> Dict:
        """Calculate detailed coverage statistics."""
        total = len(study_pairs)
        answered = sum(1 for pair in study_pairs if pair['answer'] is not None)
        
        return {
            'total_questions': total,
            'answered_questions': answered,
            'unanswered_questions': total - answered,
            'coverage_percentage': round((answered / total) * 100, 1) if total > 0 else 0,
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
        elif len(answered_pairs) >= 100:
            recommendations['study_approach'].append("Moderate coverage for targeted study")
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
        if missing_answers > 50:
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
    
    def process_all_pdfs(self) -> Dict[str, Dict]:
        """Process all 7 PDFs and generate final study datasets."""
        results = {}
        total_questions = 0
        total_answered = 0
        
        self.logger.info("=== Starting Phase 4: V2 Data Combination for All PDFs ===")
        
        for pdf_name in self.pdf_list:
            try:
                self.logger.info(f"\n--- Processing {pdf_name} ---")
                result = self.combine_pdf_data(pdf_name)
                results[pdf_name] = result
                
                # Track totals
                metadata = result['metadata']
                total_questions += metadata['total_questions']
                total_answered += metadata['answered_questions']
                
                # Log individual results
                self.logger.info(f"✓ {pdf_name}: {metadata['answered_questions']}/{metadata['total_questions']} questions ({metadata['coverage_percentage']}% coverage)")
                
            except Exception as e:
                self.logger.error(f"✗ Failed to process {pdf_name}: {str(e)}")
                results[pdf_name] = {'error': str(e)}
        
        # Log summary
        self.logger.info("\n=== Phase 4 Summary ===")
        self.logger.info(f"Total questions across all PDFs: {total_questions}")
        self.logger.info(f"Total answered questions: {total_answered}")
        overall_coverage = (total_answered / total_questions * 100) if total_questions > 0 else 0
        self.logger.info(f"Overall coverage: {overall_coverage:.1f}%")
        
        successful_pdfs = [pdf for pdf, result in results.items() if 'error' not in result]
        failed_pdfs = [pdf for pdf, result in results.items() if 'error' in result]
        
        self.logger.info(f"Successful datasets: {len(successful_pdfs)}")
        if failed_pdfs:
            self.logger.info(f"Failed datasets: {failed_pdfs}")
        
        return results
    
    def validate_final_datasets(self) -> Dict:
        """Validate all final datasets for mobile app compatibility."""
        self.logger.info("=== Validating Final Datasets ===")
        
        validation_results = {
            'total_datasets': 0,
            'valid_datasets': 0,
            'validation_errors': [],
            'dataset_details': {}
        }
        
        data_dir = Path(__file__).parent.parent / "data"
        
        for pdf_name in self.pdf_list:
            dataset_file = data_dir / f"{pdf_name}_study_data.json"
            validation_results['total_datasets'] += 1
            
            if not dataset_file.exists():
                validation_results['validation_errors'].append(f"Missing dataset file: {dataset_file}")
                continue
            
            try:
                # Load and validate dataset
                with open(dataset_file, 'r', encoding='utf-8') as f:
                    dataset = json.load(f)
                
                # Validate structure matches V1 format
                required_keys = ['metadata', 'study_data', 'topics', 'study_recommendations']
                missing_keys = [key for key in required_keys if key not in dataset]
                
                if missing_keys:
                    validation_results['validation_errors'].append(
                        f"{pdf_name}: Missing keys {missing_keys}"
                    )
                    continue
                
                # Validate question-answer pairing
                study_data = dataset['study_data']
                total_questions = len(study_data)
                answered_questions = sum(1 for item in study_data if item['answer'] is not None)
                
                # Check for valid answer indices
                invalid_answers = []
                for item in study_data:
                    if item['answer'] is not None:
                        correct_answer = item['answer'].get('correct_answer', '')
                        # Validate answer format (should be list of indices or string)
                        if not correct_answer:
                            invalid_answers.append(item['question_number'])
                
                validation_results['valid_datasets'] += 1
                validation_results['dataset_details'][pdf_name] = {
                    'total_questions': total_questions,
                    'answered_questions': answered_questions,
                    'coverage_percentage': round((answered_questions / total_questions) * 100, 1) if total_questions > 0 else 0,
                    'invalid_answers': len(invalid_answers),
                    'mobile_compatible': True
                }
                
                self.logger.info(f"✓ {pdf_name}: {answered_questions}/{total_questions} questions, mobile compatible")
                
            except Exception as e:
                validation_results['validation_errors'].append(f"{pdf_name}: {str(e)}")
                self.logger.error(f"✗ {pdf_name}: Validation failed - {str(e)}")
        
        return validation_results


def main():
    """Main entry point for V2 data combiner."""
    parser = argparse.ArgumentParser(description='Combine V2 classified questions with enhanced and aggressive answers')
    parser.add_argument('--pdf', help='Specific PDF to process (e.g., clf-c02_2)')
    parser.add_argument('--all', action='store_true', help='Process all 7 PDFs')
    parser.add_argument('--validate', action='store_true', help='Validate final datasets')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    
    args = parser.parse_args()
    
    if not any([args.pdf, args.all, args.validate]):
        parser.error("Must specify --pdf, --all, or --validate")
    
    try:
        combiner = V2DataCombiner(log_level=args.log_level)
        
        if args.validate:
            # Validate existing datasets
            validation_results = combiner.validate_final_datasets()
            
            print(f"\n=== Dataset Validation Results ===")
            print(f"Total datasets: {validation_results['total_datasets']}")
            print(f"Valid datasets: {validation_results['valid_datasets']}")
            
            if validation_results['validation_errors']:
                print(f"\nValidation Errors:")
                for error in validation_results['validation_errors']:
                    print(f"  - {error}")
            
            print(f"\nDataset Details:")
            for pdf_name, details in validation_results['dataset_details'].items():
                print(f"  {pdf_name}: {details['answered_questions']}/{details['total_questions']} questions ({details['coverage_percentage']}%)")
            
        elif args.all:
            # Process all PDFs
            results = combiner.process_all_pdfs()
            
            # Print comprehensive summary
            print(f"\n=== Phase 4 Final Results ===")
            
            successful_datasets = []
            failed_datasets = []
            total_questions = 0
            total_answered = 0
            
            for pdf_name, result in results.items():
                if 'error' in result:
                    failed_datasets.append(pdf_name)
                    print(f"✗ {pdf_name}: FAILED - {result['error']}")
                else:
                    successful_datasets.append(pdf_name)
                    metadata = result['metadata']
                    total_questions += metadata['total_questions']
                    total_answered += metadata['answered_questions']
                    print(f"✓ {pdf_name}: {metadata['answered_questions']}/{metadata['total_questions']} questions ({metadata['coverage_percentage']}%)")
            
            print(f"\nOverall Summary:")
            print(f"  Successful datasets: {len(successful_datasets)}/7")
            print(f"  Total questions: {total_questions}")
            print(f"  Total answered: {total_answered}")
            overall_coverage = (total_answered / total_questions * 100) if total_questions > 0 else 0
            print(f"  Overall coverage: {overall_coverage:.1f}%")
            
            if failed_datasets:
                print(f"  Failed datasets: {failed_datasets}")
            
            # Validate final datasets
            print(f"\n=== Final Validation ===")
            validation_results = combiner.validate_final_datasets()
            print(f"Mobile app compatibility: {validation_results['valid_datasets']}/{validation_results['total_datasets']} datasets")
            
        elif args.pdf:
            # Process single PDF
            if args.pdf not in combiner.pdf_list:
                print(f"Error: PDF '{args.pdf}' not in supported list: {combiner.pdf_list}")
                sys.exit(1)
            
            result = combiner.combine_pdf_data(args.pdf)
            
            # Print summary for single PDF
            metadata = result['metadata']
            print(f"\n=== Data Combination Complete: {args.pdf} ===")
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
            
            output_path = Path(__file__).parent.parent / "data" / f"{args.pdf}_study_data.json"
            print(f"\nOutput saved to: {output_path}")
        
    except Exception as e:
        print(f"V2 Data combination failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()