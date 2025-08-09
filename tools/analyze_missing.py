#!/usr/bin/env python3
"""
Analyze missing questions between PDF and source text file
"""
import subprocess
import json

def main():
    # Get all question numbers from source file
    result = subprocess.run(['grep', '-o', r'[0-9]\+]', 'docs/exam-material/AWS SAA-03 Solution.txt'], 
                           capture_output=True, text=True)
    source_numbers = set(int(num.strip(']')) for num in result.stdout.strip().split('\n') if num.strip())

    # Get all question numbers from PDF (1-681)
    pdf_numbers = set(range(1, 682))

    # Find missing questions from source
    missing_from_source = pdf_numbers - source_numbers

    print(f'=== Source File Analysis ===')
    print(f'Questions in PDF: {len(pdf_numbers)} (1-681)')
    print(f'Questions in source text: {len(source_numbers)} (actual segments)')
    print(f'Questions missing from source: {len(missing_from_source)}')
    print(f'Missing percentage: {len(missing_from_source)/len(pdf_numbers)*100:.1f}%')

    # Show some missing ranges
    missing_list = sorted(list(missing_from_source))
    print(f'\nFirst 30 missing from source: {missing_list[:30]}')
    print(f'Last 20 missing from source: {missing_list[-20:]}')

    # Check some ranges
    ranges = []
    if missing_list:
        start = missing_list[0]
        for i in range(1, len(missing_list)):
            if missing_list[i] != missing_list[i-1] + 1:
                if start == missing_list[i-1]:
                    ranges.append(str(start))
                else:
                    ranges.append(f'{start}-{missing_list[i-1]}')
                start = missing_list[i]
        # Add final range
        if start == missing_list[-1]:
            ranges.append(str(start))
        else:
            ranges.append(f'{start}-{missing_list[-1]}')

    print(f'\nMissing ranges: {ranges[:15]}')  # First 15 ranges
    
    # Now check what we actually extracted vs what's available
    data = json.load(open('data/answers_enhanced.json'))
    extracted_numbers = set(ans['answer_number'] for ans in data['answers'])
    
    # Available in source but not extracted
    available_but_not_extracted = source_numbers - extracted_numbers
    print(f'\n=== Extraction Analysis ===')
    print(f'Available in source: {len(source_numbers)}')
    print(f'Successfully extracted: {len(extracted_numbers)}')
    print(f'Available but not extracted: {len(available_but_not_extracted)}')
    
    if available_but_not_extracted:
        not_extracted_list = sorted(list(available_but_not_extracted))
        print(f'Not extracted: {not_extracted_list[:20]}')

if __name__ == '__main__':
    main()