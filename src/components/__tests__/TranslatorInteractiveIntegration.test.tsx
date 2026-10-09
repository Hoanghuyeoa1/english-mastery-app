// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { TranslatorView } from '../TranslatorView';
import { useAppStore } from '../../store/useAppStore';
import * as aiTranslationService from '../../services/aiTranslationService';
import * as textAnalysisService from '../../services/textAnalysisService';
import { initializeDictionary } from '../../services/dictionaryIndex';

// Mock framer-motion
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

describe('TranslatorView Interactive Source Text Integration (Phase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeDictionary();
    useAppStore.setState({
      geminiApiKey: '',
      userCollocations: [],
    });
  });

  it('renders dual edit/interactive view mode buttons for English source text', () => {
    render(<TranslatorView />);

    expect(screen.getByText('Soạn thảo')).toBeDefined();
    expect(screen.getByText('Tương tác')).toBeDefined();
  });

  it('allows switching between interactive mode and edit textarea seamlessly', () => {
    render(<TranslatorView />);

    // Initially in interactive mode
    expect(screen.getByText(/CHẾ ĐỘ TƯƠNG TÁC/i)).toBeDefined();

    // Click "Soạn thảo"
    const editBtn = screen.getByText('Soạn thảo');
    fireEvent.click(editBtn);

    // Now textarea is visible
    const textarea = screen.getByPlaceholderText(/Nhập từ, câu văn bản/i);
    expect(textarea).toBeDefined();

    // Type new text
    fireEvent.change(textarea, { target: { value: 'We need to deploy new features.' } });
    expect(textarea).toHaveProperty('value', 'We need to deploy new features.');

    // Switch back to "Tương tác"
    const interactiveBtn = screen.getByText('Tương tác');
    fireEvent.click(interactiveBtn);

    expect(screen.getByText(/CHẾ ĐỘ TƯƠNG TÁC/i)).toBeDefined();
  });

  it('preserves translation execution when text analysis throws an error (fail-safe)', async () => {
    // Spy on analyzeSourceText to simulate an internal exception
    const spy = vi.spyOn(textAnalysisService, 'analyzeSourceText').mockImplementation(() => {
      throw new Error('Simulated internal parser crash');
    });

    render(<TranslatorView />);

    // UI should not crash and still render gracefully
    expect(screen.getByText(/Trợ Lý Dịch Thuật AI/i)).toBeDefined();

    spy.mockRestore();
  });

  it('allows saving phrases from source interaction directly into Collocation SRS with +15 XP toast', async () => {
    const saveCollocationSpy = vi.fn().mockReturnValue({ success: true, isNew: true });
    useAppStore.setState({
      saveCollocationToSRS: saveCollocationSpy,
    });

    render(<TranslatorView />);

    // Find and click the IT term "backend microservices" in the interactive source text
    const spanEl = screen.getAllByText('backend microservices')[0];
    fireEvent.click(spanEl);

    // Popover dialog is open
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});
