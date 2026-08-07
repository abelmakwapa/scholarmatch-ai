"""
Database session management for ScholarMatch.
"""
from contextlib import contextmanager
from typing import Generator

# Mock session for testing - in production this would be SQLAlchemy
class MockDBSession:
    def __init__(self):
        self.objects = []
        
    def query(self, model):
        return MockQuery(model, self.objects)
        
    def add(self, obj):
        self.objects.append(obj)
        
    def commit(self):
        pass
        
    def refresh(self, obj):
        pass
        
    def delete(self, obj):
        if obj in self.objects:
            self.objects.remove(obj)

class MockQuery:
    def __init__(self, model, objects):
        self.model = model
        self.objects = objects
        self._filters = []
        
    def filter(self, condition):
        self._filters.append(condition)
        return self
        
    def first(self):
        # Simplified - return first object matching filters
        for obj in self.objects:
            if isinstance(obj, self.model):
                return obj
        return None
        
    def all(self):
        return [obj for obj in self.objects if isinstance(obj, self.model)]
        
    def count(self):
        return len([obj for obj in self.objects if isinstance(obj, self.model)])

@contextmanager
def get_db_session() -> Generator[MockDBSession, None, None]:
    """Get a database session context manager."""
    db = MockDBSession()
    try:
        yield db
    finally:
        pass  # Cleanup if needed
