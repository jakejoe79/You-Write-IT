import { useMemo, useState } from 'react';
import { ROLE_COLORS, EMOTION_COLORS, parseHighlights, detectEmotions, extractCharacters, extractInventory, getCanonicalName } from '../utils/highlightParser.js';

/**
 * HighlightedContent - Renders chapter content with inline highlights for characters, emotions, and inventory
 * Now with directional emotion tracking and inventory memory
 */
export default function HighlightedContent({ 
  content, 
  characters = [], 
  inventory = [],
  emotionState = null,
  previousEmotionState = null,  // For directional tracking
  showHighlights = true,
  onCharacterClick,
  onInventoryClick,
  inventoryOrigins = {},  // { itemName: { firstChapter, lastChapter } }
}) {
  const [hoveredItem, setHoveredItem] = useState(null);
  
  // Parse content into highlighted segments
  const segments = useMemo(() => {
    if (!showHighlights || !content) return [{ type: 'text', content }];
    return parseHighlights(content, characters, inventory);
  }, [content, characters, inventory, showHighlights]);
  
  // Detect emotions from content
  const detectedEmotions = useMemo(() => {
    if (!content) return [];
    return detectEmotions(content);
  }, [content]);
  
  // Calculate directional emotion changes
  const directionalEmotions = useMemo(() => {
    if (!emotionState || !previousEmotionState) return null;
    
    const directions = [];
    const emotions = emotionState.protagonist || {};
    const prevEmotions = (previousEmotionState.protagonist || {});
    
    for (const [emotion, value] of Object.entries(emotions)) {
      const prevValue = prevEmotions[emotion] || 0;
      const diff = value - prevValue;
      
      if (Math.abs(diff) > 0.05) {  // Only show significant changes
        directions.push({
          emotion,
          current: value,
          previous: prevValue,
          change: diff,
          direction: diff > 0 ? '↑' : diff < 0 ? '↓' : '→',
          color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : '#6b7280',
        });
      }
    }
    
    return directions.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }, [emotionState, previousEmotionState]);
  
  // Get character status for each character
  const characterStatus = useMemo(() => {
    return characters.map(char => ({
      name: typeof char === 'string' ? char : char.name,
      canonical: typeof char === 'string' ? getCanonicalName(char) : getCanonicalName(char.name),
      ...ROLE_COLORS[inferCharacterRole(char.name || char, content, characters)] || ROLE_COLORS.neutral,
    }));
  }, [characters, content]);
  
  return (
    <div className="highlighted-content">
      {/* Directional emotion badges (if previous state available) */}
      {directionalEmotions && directionalEmotions.length > 0 && (
        <div className="emotion-overlay" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          {directionalEmotions.slice(0, 3).map(({ emotion, current, direction, color }) => (
            <span
              key={emotion}
              className="emotion-indicator"
              style={{
                background: EMOTION_COLORS[emotion]?.bg || 'rgba(148, 163, 184, 0.15)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                borderLeft: `3px solid ${color}`,
              }}
            >
              {EMOTION_COLORS[emotion]?.icon || '🎭'} {emotion} {Math.round(current * 100)}% {direction}
            </span>
          ))}
        </div>
      )}
      
      {/* Fallback to static badges if no previous state */}
      {!directionalEmotions && detectedEmotions.length > 0 && (
        <div className="emotion-overlay" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          {detectedEmotions.slice(0, 3).map(({ emotion, intensity }) => {
            const color = EMOTION_COLORS[emotion] || EMOTION_COLORS.tension;
            return (
              <span
                key={emotion}
                className="emotion-indicator"
                style={{
                  background: color.bg,
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  borderLeft: `3px solid ${color.border}`,
                }}
              >
                {color.icon} {emotion} {Math.round(intensity * 100)}%
              </span>
            );
          })}
        </div>
      )}
      
      {/* Character legend */}
      {showHighlights && characterStatus.length > 0 && (
        <div className="character-legend" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {characterStatus.map(char => (
            <span
              key={char.name}
              className="character-badge"
              onMouseEnter={() => setHoveredItem({ type: 'character', name: char.name })}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                background: char.bg,
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.7rem',
                border: `1px solid ${char.border}`,
                cursor: 'pointer',
              }}
            >
              {char.isDead && <span style={{ textDecoration: 'line-through' }}>✝</span>}
              {char.name}
            </span>
          ))}
        </div>
      )}
      
      {/* Inventory legend with memory */}
      {showHighlights && inventory.length > 0 && (
        <div className="inventory-legend" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {inventory.map(item => {
            const origin = inventoryOrigins[item] || {};
            return (
              <span
                key={item}
                className="inventory-badge"
                onMouseEnter={() => setHoveredItem({ 
                  type: 'inventory', 
                  name: item,
                  origin: origin.firstChapter,
                  lastReferenced: origin.lastChapter,
                })}
                onMouseLeave={() => setHoveredItem(null)}
                style={{
                  background: 'rgba(251, 191, 36, 0.2)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  border: '1px solid #fbbf24',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dotted',
                }}
              >
                {item}
                {origin.firstChapter !== undefined && (
                  <span style={{ marginLeft: '0.25rem', opacity: 0.7 }}>
                    (Ch. {origin.firstChapter + 1})
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}
      
      {/* Content with highlights */}
      <div 
        className="content-text"
        style={{ 
          lineHeight: '1.7',
          fontSize: '1rem',
        }}
      >
        {segments.map((segment, i) => {
          if (segment.type === 'text') {
            return <span key={i}>{segment.content}</span>;
          }
          
          if (segment.type === 'character') {
            const role = inferCharacterRole(segment.content, content, characters);
            const colors = ROLE_COLORS[role] || ROLE_COLORS.neutral;
            const isDead = isCharacterDead(segment.content, content);
            
            return (
              <span
                key={i}
                className="highlighted-character"
                onMouseEnter={() => setHoveredItem({ type: 'character', name: segment.content })}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => onCharacterClick?.(segment.content)}
                style={{
                  background: colors.bg,
                  borderBottom: `2px solid ${colors.border}`,
                  padding: '0 2px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontWeight: isDead ? 'normal' : '500',
                  textDecoration: isDead ? 'line-through' : 'none',
                }}
              >
                {segment.content}
              </span>
            );
          }
          
          if (segment.type === 'inventory') {
            return (
              <span
                key={i}
                className="highlighted-inventory"
                onMouseEnter={() => setHoveredItem({ type: 'inventory', name: segment.content })}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => onInventoryClick?.(segment.content)}
                style={{
                  background: 'rgba(251, 191, 36, 0.15)',
                  borderBottom: '2px dotted #fbbf24',
                  padding: '0 2px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}
              >
                {segment.content}
              </span>
            );
          }
          
          return null;
        })}
      </div>
      
      {/* Tooltip */}
      {hoveredItem && (
        <div
          className="highlight-tooltip"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: '#1a1a2e',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '0.75rem',
            maxWidth: '250px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {hoveredItem.type === 'character' ? '👤 Character' : '🎒 Inventory'}
          </div>
          <div style={{ fontSize: '0.9rem' }}>{hoveredItem.name}</div>
          {hoveredItem.type === 'character' && (
            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
              {ROLE_COLORS[inferCharacterRole(hoveredItem.name, content, characters)]?.label || 'Character'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper functions (also exported for reuse)
function inferCharacterRole(name, content, allCharacters) {
  const lowerContent = content.toLowerCase();
  const lowerName = name.toLowerCase();
  
  const mentionCount = (lowerContent.match(new RegExp(lowerName, 'gi')) || []).length;
  
  if (mentionCount > 5 || lowerContent.includes(`${lowerName} thought`) || lowerContent.includes(`${lowerName} felt`)) {
    return 'protagonist';
  }
  
  if (lowerContent.includes('villain') || lowerContent.includes('enemy') || lowerContent.includes('threat')) {
    return 'antagonist';
  }
  
  if (lowerContent.includes('teacher') || lowerContent.includes('guide') || lowerContent.includes('trainer')) {
    return 'mentor';
  }
  
  return 'neutral';
}

function isCharacterDead(name, content) {
  const patterns = [
    new RegExp(`${name}.*?(?:died|dead|killed|passed away|is no more)`, 'gi'),
    new RegExp(`(?:died|dead|killed).*?${name}`, 'gi'),
  ];
  
  return patterns.some(p => p.test(content));
}