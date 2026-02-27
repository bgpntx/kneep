/**
 * QueueItem — sortable queue item component for the jukebox playlist.
 */
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function JukeboxQueueItem({ song, index, displayNum, currentIndex, onAction, id }) {
    const isCurrent = index === currentIndex;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: 'none',
    };

    const className = `qitem${isCurrent ? ' current' : ''}${isDragging ? ' dragging' : ''}`;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={className}
            data-index={index}
        >
            <div className="idx">{displayNum}</div>
            <div>
                <div className="qi-title">{song.title || 'Unknown'}</div>
                <div className="qi-meta">{song.artist || 'Unknown'}</div>
            </div>
            <div className="qi-actions">
                <button
                    title="Play here"
                    className="btn"
                    onClick={(e) => { e.stopPropagation(); onAction('play', index); }}
                    onPointerDown={(e) => e.stopPropagation()}
                >▶️</button>
                <button
                    title="Remove"
                    className="btn"
                    onClick={(e) => { e.stopPropagation(); onAction('remove', index); }}
                    onPointerDown={(e) => e.stopPropagation()}
                >✖️</button>
            </div>
        </div>
    );
}
