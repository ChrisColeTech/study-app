#!/usr/bin/env python3
"""
Batch AI Answering Tool

Splits missing questions into smaller batches and uses Task agents to answer each batch.
This approach is more reliable than trying to process all 155 questions at once.
"""
import json
import math
from pathlib import Path


class BatchAnsweringTool:
    """Split questions into batches for AI answering."""
    
    def __init__(self, batch_size: int = 25):
        self.batch_size = batch_size
        
    def create_batches(self, questions_file: str, output_dir: str = "data/batches") -> list:
        """Split questions into batches and save to separate files."""
        
        # Load missing questions
        with open(questions_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        questions = data['missing_questions']
        total_questions = len(questions)
        num_batches = math.ceil(total_questions / self.batch_size)
        
        print(f"Splitting {total_questions} questions into {num_batches} batches of ~{self.batch_size} questions each")
        
        # Create output directory
        batch_dir = Path(output_dir)
        batch_dir.mkdir(exist_ok=True)
        
        batch_files = []
        
        for i in range(num_batches):
            start_idx = i * self.batch_size
            end_idx = min(start_idx + self.batch_size, total_questions)
            batch_questions = questions[start_idx:end_idx]
            
            batch_data = {
                "metadata": {
                    "batch_number": i + 1,
                    "total_batches": num_batches,
                    "questions_in_batch": len(batch_questions),
                    "question_range": f"{batch_questions[0]['question_number']}-{batch_questions[-1]['question_number']}",
                    "instructions": {
                        "task": "Answer each AWS SAA-C03 exam question with the correct letter choice(s)",
                        "format": "Provide correct_answer and explanation for each question",
                        "output_format": "JSON with ai_answers array",
                        "example_output": {
                            "ai_answers": [
                                {
                                    "question_number": 36,
                                    "correct_answer": "B",
                                    "explanation": "Multi-Region KMS key provides least operational overhead for cross-region encryption."
                                }
                            ]
                        }
                    }
                },
                "questions": batch_questions
            }
            
            batch_filename = f"batch_{i+1:02d}_questions.json"
            batch_path = batch_dir / batch_filename
            
            with open(batch_path, 'w', encoding='utf-8') as f:
                json.dump(batch_data, f, indent=2, ensure_ascii=False)
            
            batch_files.append(str(batch_path))
            print(f"Created batch {i+1}: {len(batch_questions)} questions -> {batch_path}")
        
        # Create batch summary
        summary = {
            "total_questions": total_questions,
            "num_batches": num_batches,
            "batch_size": self.batch_size,
            "batch_files": batch_files,
            "instructions_for_agents": {
                "task": "Process each batch file and generate answers",
                "output_naming": "batch_XX_answers.json (same directory)",
                "merge_command": "After all batches complete, run merge script"
            }
        }
        
        summary_path = batch_dir / "batch_summary.json"
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        print(f"\nBatch summary saved to: {summary_path}")
        return batch_files


def main():
    """Create question batches for AI processing."""
    
    questions_file = "data/missing_questions_for_ai.json"
    
    if not Path(questions_file).exists():
        print(f"Error: Questions file not found: {questions_file}")
        return
    
    # Create batches
    batch_tool = BatchAnsweringTool(batch_size=25)  # 25 questions per batch
    batch_files = batch_tool.create_batches(questions_file)
    
    print(f"\n✅ Created {len(batch_files)} batch files")
    print(f"📁 Batch files location: data/batches/")
    print(f"📋 Next step: Use Task agents to process each batch")
    print(f"🔄 After completion: Run merge tool to combine all answers")


if __name__ == '__main__':
    main()