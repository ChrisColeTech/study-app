#!/usr/bin/env python3
"""
Merge AI-generated answers back into the final study dataset
"""
import json
import argparse
from datetime import datetime
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description='Merge AI-generated answers into study dataset')
    parser.add_argument('--ai-answers', required=True, help='Path to AI-generated answers JSON')
    parser.add_argument('--study-data', default='data/study_data_final.json', help='Path to study dataset')
    parser.add_argument('--output', default='data/study_data_complete.json', help='Output path for complete dataset')
    
    args = parser.parse_args()
    
    print("Merging AI-generated answers into study dataset...")
    
    # Load study dataset
    with open(args.study_data, 'r') as f:
        study_data = json.load(f)
    
    # Load AI answers
    with open(args.ai_answers, 'r') as f:
        ai_data = json.load(f)
    
    # Create lookup for AI answers
    ai_answers_lookup = {}
    if 'ai_answers' in ai_data:
        for answer in ai_data['ai_answers']:
            ai_answers_lookup[answer['question_number']] = answer
    
    # Merge answers
    merged_count = 0
    for pair in study_data['study_data']:
        if pair['answer'] is None and pair['question_number'] in ai_answers_lookup:
            ai_answer = ai_answers_lookup[pair['question_number']]
            
            # Add AI-generated answer
            pair['answer'] = {
                'correct_answer': ai_answer['correct_answer'],
                'explanation': ai_answer.get('explanation', ''),
                'keywords': ai_answer.get('keywords', []),
                'parsing_confidence': 0.8,  # AI-generated confidence
                'source': 'ai_generated'
            }
            
            # Update metadata
            pair['study_metadata'].update({
                'has_explanation': bool(ai_answer.get('explanation', '').strip()),
                'confidence_level': 'high',
                'completeness': 'ai_generated'
            })
            
            merged_count += 1
    
    # Update dataset metadata
    study_data['metadata']['ai_answers_merged'] = merged_count
    study_data['metadata']['final_coverage'] = {
        'total_questions': 681,
        'answered_questions': 526 + merged_count,
        'coverage_percentage': round((526 + merged_count) / 681 * 100, 1)
    }
    study_data['metadata']['last_updated'] = datetime.now().isoformat()
    
    # Save complete dataset
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(study_data, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully merged {merged_count} AI-generated answers")
    print(f"New coverage: {526 + merged_count}/681 = {(526 + merged_count)/681*100:.1f}%")
    print(f"Complete dataset saved to: {args.output}")

if __name__ == '__main__':
    main()