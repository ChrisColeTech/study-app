#!/usr/bin/env python3
"""
Extract missing questions in a format ready for AI answering
"""
import json
from pathlib import Path

def main():
    print("Extracting missing questions for AI answering...")
    
    # Load final study data
    with open('data/study_data_final.json', 'r') as f:
        study_data = json.load(f)
    
    # Find questions without answers
    missing_questions = []
    
    for pair in study_data['study_data']:
        if pair['answer'] is None:
            question_info = {
                'question_number': pair['question_number'],
                'question_text': pair['question']['text'],
                'options': pair['question']['options'],
                'question_type': pair['question']['question_type'],
                'expected_answers': pair['question']['expected_answers'],
                'topic': pair['question']['topic'],
                'aws_services': pair['question']['aws_services']
            }
            missing_questions.append(question_info)
    
    print(f"Found {len(missing_questions)} questions without answers")
    
    # Save in a clean format for AI processing
    output = {
        'metadata': {
            'total_missing_questions': len(missing_questions),
            'extraction_date': '2025-08-07',
            'format': 'ready_for_ai_answering',
            'instructions': {
                'task': 'Answer each AWS SAA-C03 exam question with the correct letter choice(s)',
                'format': 'For each question, provide: correct_answer (letter choice like "B" or "A, D"), explanation (brief reasoning)',
                'example': {
                    'question_number': 51,
                    'correct_answer': 'B',
                    'explanation': 'Amazon S3 Transfer Acceleration uses CloudFront edge locations to speed up uploads.'
                }
            }
        },
        'missing_questions': missing_questions
    }
    
    # Save to file
    output_file = 'data/missing_questions_for_ai.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"Missing questions saved to: {output_file}")
    print(f"\nFirst 3 missing questions:")
    for i, q in enumerate(missing_questions[:3]):
        print(f"\n{i+1}. Question {q['question_number']} ({q['topic']})")
        print(f"   {q['question_text'][:100]}...")
        print(f"   Options: {len(q['options'])} choices")
    
    print(f"\nNext step: Use AI to answer these {len(missing_questions)} questions")
    print("Then we can merge the answers back into the final dataset")

if __name__ == '__main__':
    main()