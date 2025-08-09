#!/usr/bin/env python3
"""
Identify missing questions for research tool
"""
import json

def main():
    # Load final study data to see what's missing
    data = json.load(open('data/study_data_final.json'))
    answered_questions = set()
    missing_questions = []

    for pair in data['study_data']:
        if pair['answer'] is not None:
            answered_questions.add(pair['question_number'])
        else:
            missing_questions.append(pair['question_number'])

    print(f'=== Missing Answer Analysis ===')
    print(f'Total questions: 681')
    print(f'Answered questions: {len(answered_questions)}')
    print(f'Missing answers: {len(missing_questions)}')
    print(f'Missing percentage: {len(missing_questions)/681*100:.1f}%')

    # Show missing ranges
    missing_questions.sort()
    print(f'\nFirst 20 missing: {missing_questions[:20]}')
    print(f'Last 20 missing: {missing_questions[-20:]}')

    # Find missing ranges
    ranges = []
    if missing_questions:
        start = missing_questions[0]
        for i in range(1, len(missing_questions)):
            if missing_questions[i] != missing_questions[i-1] + 1:
                if start == missing_questions[i-1]:
                    ranges.append(str(start))
                else:
                    ranges.append(f'{start}-{missing_questions[i-1]}')
                start = missing_questions[i]
        
        # Add final range
        if start == missing_questions[-1]:
            ranges.append(str(start))
        else:
            ranges.append(f'{start}-{missing_questions[-1]}')

    print(f'\nMissing ranges: {ranges[:10]}')  # First 10 ranges

    # Save missing questions for research tool
    missing_data = {
        'total_missing': len(missing_questions),
        'missing_questions': missing_questions,
        'missing_ranges': ranges
    }
    
    with open('data/missing_questions.json', 'w') as f:
        json.dump(missing_data, f, indent=2)
    
    print(f'\nMissing questions saved to: data/missing_questions.json')

if __name__ == '__main__':
    main()