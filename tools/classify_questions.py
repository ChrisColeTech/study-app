#!/usr/bin/env python3
"""
Service Classifier Tool - Phase 1.1

Takes the raw questions from PDF parser and classifies them into logical 
study topics based on AWS service content analysis.

Usage:
    python classify_questions.py --input data/questions_raw.json --output data/questions_classified.json
"""

import json
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List
from service_classifier import ServiceClassifier


def classify_questions(input_file: str, output_file: str, log_level: str = "INFO"):
    """
    Classify questions from PDF parser output into logical topic groups.
    
    Args:
        input_file: Path to questions_raw.json from PDF parser
        output_file: Path to save classified questions
        log_level: Logging level
    """
    
    # Setup logging
    log_dir = Path(__file__).parent.parent / "logs"
    log_dir.mkdir(exist_ok=True)
    
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_dir / f"classifier_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
            logging.StreamHandler()
        ]
    )
    logger = logging.getLogger(__name__)
    
    logger.info(f"Starting question classification from: {input_file}")
    
    # Load raw questions
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
    except Exception as e:
        logger.error(f"Failed to load input file: {str(e)}")
        raise
    
    questions = raw_data.get('questions', [])
    logger.info(f"Loaded {len(questions)} questions for classification")
    
    # Initialize classifier
    classifier = ServiceClassifier()
    
    # Classify each question
    classified_questions = []
    classification_stats = {
        'total_classified': 0,
        'topic_counts': {},
        'confidence_distribution': [],
        'low_confidence_questions': [],
        'processing_errors': []
    }
    
    for i, question in enumerate(questions):
        try:
            # Classify the question
            topic_id, confidence, services = classifier.classify_question(question['question_text'])
            
            # Update question with new topic information
            classified_question = question.copy()
            classified_question['original_topic'] = question['topic_number']  # Preserve original
            classified_question['topic_number'] = topic_id  # Update to logical topic
            classified_question['topic_name'] = classifier.get_topic_info(topic_id).get('name', 'Unknown')
            classified_question['classification_confidence'] = round(confidence, 3)
            classified_question['detected_services'] = services
            classified_question['question_id'] = f't{topic_id}_q{i+1}'  # Update ID with new topic
            
            classified_questions.append(classified_question)
            
            # Update statistics
            classification_stats['total_classified'] += 1
            classification_stats['topic_counts'][topic_id] = classification_stats['topic_counts'].get(topic_id, 0) + 1
            classification_stats['confidence_distribution'].append(confidence)
            
            # Track low confidence classifications for review
            if confidence < 0.3:
                classification_stats['low_confidence_questions'].append({
                    'question_number': question['question_number'],
                    'topic_assigned': topic_id,
                    'confidence': confidence,
                    'services': services,
                    'preview': question['question_text'][:100]
                })
            
            # Log progress
            if (i + 1) % 100 == 0:
                logger.info(f"Classified {i + 1} questions")
                
        except Exception as e:
            logger.error(f"Failed to classify question {question.get('question_number', i+1)}: {str(e)}")
            classification_stats['processing_errors'].append({
                'question_number': question.get('question_number', i+1),
                'error': str(e)
            })
            # Keep original question unchanged if classification fails
            classified_questions.append(question)
    
    # Calculate final statistics
    avg_confidence = sum(classification_stats['confidence_distribution']) / len(classification_stats['confidence_distribution'])
    
    # Create topic distribution with names
    topic_distribution = {}
    for topic_id, count in classification_stats['topic_counts'].items():
        topic_info = classifier.get_topic_info(topic_id)
        topic_distribution[f"Topic {topic_id}"] = {
            'name': topic_info.get('name', 'Unknown'),
            'count': count,
            'percentage': round((count / len(classified_questions)) * 100, 1)
        }
    
    # Update original metadata
    original_metadata = raw_data.get('metadata', {})
    updated_metadata = original_metadata.copy()
    updated_metadata.update({
        'classification_date': datetime.now().isoformat(),
        'classification_version': '1.0',
        'original_topics': 1,  # All questions were originally Topic 1
        'classified_topics': len(classification_stats['topic_counts']),
        'average_classification_confidence': round(avg_confidence, 3),
        'low_confidence_count': len(classification_stats['low_confidence_questions']),
        'processing_errors': len(classification_stats['processing_errors']),
        'topic_distribution': topic_distribution
    })
    
    # Create final output
    output_data = {
        'metadata': updated_metadata,
        'questions': classified_questions,
        'classification_report': {
            'summary': {
                'total_questions': len(classified_questions),
                'successfully_classified': classification_stats['total_classified'],
                'average_confidence': round(avg_confidence, 3),
                'topics_created': len(classification_stats['topic_counts'])
            },
            'topic_breakdown': topic_distribution,
            'quality_metrics': {
                'high_confidence_count': len([c for c in classification_stats['confidence_distribution'] if c >= 0.5]),
                'medium_confidence_count': len([c for c in classification_stats['confidence_distribution'] if 0.3 <= c < 0.5]),
                'low_confidence_count': len([c for c in classification_stats['confidence_distribution'] if c < 0.3])
            },
            'review_needed': classification_stats['low_confidence_questions'],
            'errors': classification_stats['processing_errors']
        }
    }
    
    # Save classified questions
    try:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Classification complete. Output saved to: {output_path}")
        
    except Exception as e:
        logger.error(f"Failed to save output: {str(e)}")
        raise
    
    # Print summary report
    print(f"\n=== Question Classification Complete ===")
    print(f"Total questions classified: {len(classified_questions)}")
    print(f"Average confidence: {avg_confidence:.3f}")
    print(f"Topics created: {len(classification_stats['topic_counts'])}")
    print(f"Low confidence questions: {len(classification_stats['low_confidence_questions'])}")
    print(f"Processing errors: {len(classification_stats['processing_errors'])}")
    
    print(f"\nTopic Distribution:")
    for topic_name, info in topic_distribution.items():
        print(f"  {topic_name} - {info['name']}: {info['count']} questions ({info['percentage']}%)")
    
    if classification_stats['low_confidence_questions']:
        print(f"\nLow Confidence Questions (may need manual review):")
        for item in classification_stats['low_confidence_questions'][:5]:  # Show first 5
            print(f"  Q{item['question_number']}: Topic {item['topic_assigned']}, Confidence {item['confidence']:.2f}")
            print(f"    {item['preview']}...")
    
    if classification_stats['processing_errors']:
        print(f"\nProcessing Errors:")
        for error in classification_stats['processing_errors']:
            print(f"  Q{error['question_number']}: {error['error']}")
    
    print(f"\nOutput saved to: {output_file}")


def main():
    """Main entry point for question classifier."""
    parser = argparse.ArgumentParser(description='Classify extracted questions into logical topics')
    parser.add_argument('--input', required=True, help='Path to questions_raw.json from PDF parser')
    parser.add_argument('--output', required=True, help='Path to save classified questions JSON')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    
    args = parser.parse_args()
    
    # Validate input file
    if not Path(args.input).exists():
        print(f"Error: Input file not found: {args.input}")
        return 1
    
    try:
        classify_questions(args.input, args.output, args.log_level)
        return 0
        
    except Exception as e:
        print(f"Classification failed: {str(e)}")
        return 1


if __name__ == '__main__':
    exit(main())