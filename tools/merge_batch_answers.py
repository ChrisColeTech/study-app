#!/usr/bin/env python3
"""
Merge all batch answer files into a single AI answers file
"""
import json
from pathlib import Path
from datetime import datetime

def main():
    print("Merging all batch answer files...")
    
    batch_dir = Path("data/batches")
    all_answers = []
    total_questions = 0
    
    # Collect answers from all batch files
    for i in range(1, 8):  # batches 1-7
        batch_file = batch_dir / f"batch_{i:02d}_answers.json"
        
        if batch_file.exists():
            print(f"Loading {batch_file}")
            with open(batch_file, 'r', encoding='utf-8') as f:
                batch_data = json.load(f)
            
            batch_answers = batch_data['ai_answers']
            all_answers.extend(batch_answers)
            total_questions += len(batch_answers)
            print(f"  - Added {len(batch_answers)} answers from batch {i}")
        else:
            print(f"Warning: {batch_file} not found")
    
    # Create combined AI answers file
    combined_data = {
        "metadata": {
            "generation_date": datetime.now().isoformat(),
            "total_questions_answered": total_questions,
            "confidence_level": "high",
            "model_used": "claude",
            "batch_processing": {
                "total_batches": 7,
                "questions_per_batch": "25 (except batch 7: 5)",
                "processing_method": "Task agents with AWS expertise"
            }
        },
        "ai_answers": sorted(all_answers, key=lambda x: x['question_number'])
    }
    
    # Save combined file
    output_file = "data/ai_generated_answers.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(combined_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Successfully merged {total_questions} AI-generated answers")
    print(f"📁 Combined file saved to: {output_file}")
    print(f"🔢 Question numbers: {all_answers[0]['question_number']} to {all_answers[-1]['question_number']}")
    print(f"🎯 Next step: Run merge tool to add these to final dataset")

if __name__ == '__main__':
    main()