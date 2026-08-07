"""
Embedding service for ScholarMatch.
Handles generation and storage of vector embeddings.
"""
from typing import Optional, List, Dict, Any
import hashlib

class EmbeddingService:
    def __init__(self, model_name: str = "text-embedding-3-small"):
        self.model_name = model_name
        self.dimensions = 1536  # Depends on model
        
    def generate_content_hash(self, content: str) -> str:
        """Generate hash of content to detect changes."""
        return hashlib.sha256(content.encode()).hexdigest()
        
    def create_canonical_input(self, entity_type: str, data: Dict[str, Any]) -> str:
        """
        Create privacy-minimized canonical text for embedding.
        Excludes sensitive fields and raw documents.
        """
        if entity_type == "profile":
            # Only include non-sensitive, relevant fields
            parts = [
                data.get("academic_interests", ""),
                data.get("career_goals", ""),
                data.get("extracurricular_activities", ""),
                data.get("field_of_study", "")
            ]
        elif entity_type == "scholarship":
            parts = [
                data.get("title", ""),
                data.get("description", ""),
                data.get("eligibility_criteria", ""),
                data.get("field_of_study", "")
            ]
        else:
            parts = []
            
        # Filter out empty and join
        return " | ".join([p for p in parts if p])
        
    def should_regenerate_embedding(
        self, 
        existing_hash: Optional[str], 
        new_content: str,
        existing_version: Optional[str] = None,
        target_version: str = "v1"
    ) -> bool:
        """Check if embedding needs regeneration based on hash/version."""
        if existing_version != target_version:
            return True
        if existing_hash is None:
            return True
        new_hash = self.generate_content_hash(new_content)
        return existing_hash != new_hash
        
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding vector (placeholder for actual API call)."""
        # In production: call embedding provider API
        # Return dummy vector for now
        return [0.0] * self.dimensions
        
def delete_user_embeddings(user_id: int) -> int:
    """Delete all embeddings for a user. Returns count deleted."""
    # Implementation would query DB and delete
    return 0
