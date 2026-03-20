import { useState, useCallback, useMemo } from 'react';

/**
 * SceneEditor component - Word-like editor for a single scene
 * Used inside virtualized SceneList
 */
export default function SceneEditor({ 
  scene, 
  index, 
  onEdit, 
  onRecompute,
  readOnly = false 
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(scene.text || '');
  const [showRevisions, setShowRevisions] = useState(false);

  // Handle save
  const handleSave = useCallback(() => {
    if (editText !== scene.text) {
      onEdit(index, editText);
    }
    setEditing(false);
  }, [index, editText, scene.text, onEdit]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setEditText(scene.text || '');
    setEditing(false);
  }, [scene.text]);

  // Handle recompute
  const handleRecompute = useCallback(() => {
    if (onRecompute) {
      onRecompute(index);
    }
  }, [index, onRecompute]);

  // Get emotion badges
  const emotionBadges = useMemo(() => {
    if (!scene.emotion || !scene.emotion.protagonist) return null;
    
    return Object.entries(scene.emotion.protagonist)
      .sort(([, a], [, b]) => b - a) // Sort by value descending
      .slice(0, 3) // Top 3 emotions
      .map(([emotion, value]) => ({
        emotion,
        value: Math.round(value * 100),
        icon: getEmotionIcon(emotion)
      }));
  }, [scene.emotion]);

  // Get character highlights (placeholder for Phase 4)
  const characterHighlights = useMemo(() => {
    // In Phase 4, this will parse scene.text for character names
    return [];
  }, [scene.text]);

  // Get inventory highlights (placeholder for Phase 4)
  const inventoryHighlights = useMemo(() => {
    // In Phase 4, this will parse scene.text for inventory items
    return [];
  }, [scene.text]);

  return (
    <div className={`scene-editor ${editing ? 'editing' : ''} ${scene.status === 'edited' ? 'edited' : ''}`}>
      {/* Scene Header */}
      <div className="scene-header">
        <span className="scene-index">Scene {index + 1}</span>
        
        <div className="scene-actions">
          {scene.status === 'edited' && (
            <span className="edited-badge" title="This scene has been edited">✎ Edited</span>
          )}
          
          {!editing && !readOnly && (
            <button 
              className="btn-edit"
              onClick={() => {
                setEditText(scene.text || '');
                setEditing(true);
              }}
            >
              Edit
            </button>
          )}
          
          {onRecompute && (
            <button 
              className="btn-recompute"
              onClick={handleRecompute}
              title="Recompute next scenes after this edit"
            >
              ↻ Recompute Next
            </button>
          )}
        </div>
      </div>

      {/* Emotion Badges */}
      {emotionBadges && emotionBadges.length > 0 && (
        <div className="emotion-badges">
          {emotionBadges.map(({ emotion, value, icon }) => (
            <span 
              key={emotion} 
              className={`emotion-badge emotion-${emotion}`}
              title={`${emotion}: ${value}%`}
            >
              {icon} {emotion} {value}%
            </span>
          ))}
        </div>
      )}

      {/* Scene Content */}
      {editing ? (
        <div className="scene-edit-form">
          <textarea
            className="scene-textarea"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Edit scene content..."
            autoFocus
          />
          <div className="scene-edit-actions">
            <button className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div 
          className="scene-text"
          data-scene-index={index}
        >
          {scene.text || <em className="empty-scene">Empty scene</em>}
        </div>
      )}

      {/* Validation Status */}
      {scene.validation && scene.validation !== 'No issues found.' && (
        <div className="scene-validation">
          <span className="validation-warning">⚠️ {scene.validation}</span>
        </div>
      )}

      {/* Inline Highlights (Phase 4 placeholder) */}
      {(characterHighlights.length > 0 || inventoryHighlights.length > 0) && (
        <div className="scene-highlights">
          {characterHighlights.map((char, i) => (
            <span key={i} className={`highlight character-${char.role}`}>
              {char.name}
            </span>
          ))}
          {inventoryHighlights.map((item, i) => (
            <span key={i} className="highlight inventory-item" title="Inventory item">
              {item}
            </span>
          ))}
        </div>
      )}

      {/* Branch indicator for Adventure mode */}
      {scene.branchId && (
        <div className="scene-branch-indicator">
          Branch: {scene.branchId}
        </div>
      )}
    </div>
  );
}

/**
 * Get emotion icon for display
 */
function getEmotionIcon(emotion) {
  const icons = {
    fear: '😰',
    hope: '🤞',
    anger: '😠',
    grief: '😢',
    resolve: '💪',
    despair: '😞',
    joy: '😊',
    tension: '😬',
    description: '📖',
    internal: '🧠',
    conflict: '⚔️',
    uncertainty: '❓',
    revelation: '💡',
    quiet: '🤫',
  };
  return icons[emotion] || '🎭';
}

/**
 * Highlight text with character/inventory markers (Phase 4 implementation)
 */
export function highlightText(text, { characters = [], inventory = [] }) {
  if (!text) return '';
  
  let html = text;
  
  // Escape HTML first
  html = html.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');
  
  // Highlight characters (placeholder - will be refined in Phase 4)
  for (const char of characters) {
    const regex = new RegExp(`\\b(${char.name})\\b`, 'gi');
    html = html.replace(regex, `<span class="character-${char.role}" title="${char.role}">$1</span>`);
  }
  
  // Highlight inventory items
  for (const item of inventory) {
    const regex = new RegExp(`\\b(${item})\\b`, 'gi');
    html = html.replace(regex, `<span class="inventory-item" title="Inventory">$1</span>`);
  }
  
  return html;
}