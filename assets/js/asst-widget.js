/* Intelligence enrichment badges */
.asst-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.asst-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  cursor: help;
}

.asst-badge.sarcasm {
  background: rgba(255, 193, 7, 0.2);
  color: #f57f17;
  border: 1px solid rgba(255, 193, 7, 0.4);
}

.asst-badge.idiom {
  background: rgba(33, 150, 243, 0.2);
  color: #1565c0;
  border: 1px solid rgba(33, 150, 243, 0.4);
}

.asst-badge.ambiguous {
  background: rgba(156, 39, 176, 0.2);
  color: #6a1b9a;
  border: 1px solid rgba(156, 39, 176, 0.4);
}

/* Suggested questions */
.asst-suggestions {
  margin: 12px 0;
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.asst-suggestions-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

.asst-suggestion-btn {
  display: block;
  width: 100%;
  padding: 8px 12px;
  margin: 4px 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  text-align: left;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
}

.asst-suggestion-btn:hover {
  background: #f5f5f5;
  border-color: #2196f3;
  color: #2196f3;
}
