// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { InteractiveSourceText } from '../InteractiveSourceText';
import { analyzeSourceText, getEmptyAnalysisResult } from '../../services/textAnalysisService';
import { initializeDictionary } from '../../services/dictionaryIndex';

// Mock framer-motion to avoid Happy-DOM animation issues
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, ...props }: any) => (
      <div className={className} style={style} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('InteractiveSourceText Component (Phase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeDictionary();
  });

  const sampleText = 'We need to optimize our backend microservices to minimize latency and improve scalability.';

  it('renders interactive source text with tokens and metric chips', () => {
    const analysis = analyzeSourceText(sampleText);
    render(
      <InteractiveSourceText
        sourceText={sampleText}
        analysis={analysis}
        showCefrHighlight={true}
        onToggleCefrHighlight={vi.fn()}
      />
    );

    expect(screen.getByText(/CHẾ ĐỘ TƯƠNG TÁC/i)).toBeDefined();
    expect(screen.getByText(/Tô màu CEFR/i)).toBeDefined();
    expect(screen.getByText(new RegExp(`${analysis.wordCount} từ`))).toBeDefined();
    expect(screen.getByText(/backend microservices/i)).toBeDefined();
  });

  it('opens quick word lookup popover when clicking a single word token', () => {
    const analysis = analyzeSourceText(sampleText);
    render(
      <InteractiveSourceText
        sourceText={sampleText}
        analysis={analysis}
        showCefrHighlight={true}
      />
    );

    // Click on the single word token "our"
    const ourEl = screen.getByText('our');
    expect(ourEl).toBeDefined();

    fireEvent.click(ourEl);

    // Popover dialog should open
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(screen.getAllByText(/our/i).length).toBeGreaterThan(0);
  });

  it('opens popover when clicking a multi-word span like IT term', () => {
    const analysis = analyzeSourceText(sampleText);
    render(
      <InteractiveSourceText
        sourceText={sampleText}
        analysis={analysis}
        showCefrHighlight={true}
      />
    );

    const spanEl = screen.getByText('backend microservices');
    expect(spanEl).toBeDefined();

    fireEvent.click(spanEl);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(screen.getAllByText(/backend microservices/i).length).toBeGreaterThanOrEqual(2);
  });

  it('toggles CEFR highlight when onToggleCefrHighlight is clicked', () => {
    const onToggle = vi.fn();
    const analysis = analyzeSourceText(sampleText);

    render(
      <InteractiveSourceText
        sourceText={sampleText}
        analysis={analysis}
        showCefrHighlight={false}
        onToggleCefrHighlight={onToggle}
      />
    );

    const toggleBtn = screen.getByText(/Tô màu CEFR/i);
    fireEvent.click(toggleBtn);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders gracefully with safe fallback when analysis is empty', () => {
    const emptyAnalysis = getEmptyAnalysisResult('');
    const { container } = render(
      <InteractiveSourceText
        sourceText=""
        analysis={emptyAnalysis}
        showCefrHighlight={true}
      />
    );

    expect(container).toBeDefined();
    expect(screen.getByText(/0 từ/i)).toBeDefined();
  });

  it('handles keyboard navigation (Enter/Space) to open word lookup', () => {
    const analysis = analyzeSourceText(sampleText);
    render(
      <InteractiveSourceText
        sourceText={sampleText}
        analysis={analysis}
        showCefrHighlight={true}
      />
    );

    const wordEl = screen.getByText('our');
    fireEvent.keyDown(wordEl, { key: 'Enter', code: 'Enter' });

    expect(screen.getByRole('dialog')).toBeDefined();
  });
});
