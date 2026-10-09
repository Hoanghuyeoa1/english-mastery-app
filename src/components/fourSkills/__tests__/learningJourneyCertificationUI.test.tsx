// @vitest-environment happy-dom
// src/components/fourSkills/__tests__/learningJourneyCertificationUI.test.tsx
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LearningJourneyProgressionMap } from '../LearningJourneyProgressionMap';
import { CEFRCertificationHistoryModal } from '../CEFRCertificationHistoryModal';
import { useAppStore } from '../../../store/useAppStore';
import type { CheckpointHistoryEntry, PersistedLevelCertification } from '../../../types/levelCertification';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('Phase 11: Learning Journey Certification UI, History & Accessibility', () => {
  beforeEach(() => {
    useAppStore.setState({
      completedListeningLessonIds: [],
      fourSkillsCompletionProgress: { reading: [], speaking: [], writing: [] },
      resumeActivities: {},
      levelCertifications: {},
      checkpointHistory: [],
      fourSkillsEvidence: { listening: [], reading: [], speaking: [], writing: [] },
      fourSkillsScores: { listening: [], reading: [], speaking: [], writing: [] },
    });
  });

  it('renders lesson progress and certification status side-by-side on milestones', () => {
    // A2 has verified certification
    const a2Cert: PersistedLevelCertification = {
      level: 'A2',
      certificateId: 'CERT-A2-2026-X8Y1',
      certifiedAt: 1712345678000,
      overallScore: 85,
      skillScores: { listening: 85, reading: 85, speaking: 85, writing: 85 },
      attemptId: 'chk_a2_01',
      verifiedVersion: '2026.1',
      criteriaSummary: {
        overallRequired: 70,
        overallAchieved: 85,
        floorRequired: 55,
        minSkillAchieved: 85,
        verifiedVersion: '2026.1',
      },
    };

    useAppStore.setState({
      completedListeningLessonIds: ['listen_a1_1', 'listen_a1_2'],
      levelCertifications: { A2: a2Cert },
    });

    render(<LearningJourneyProgressionMap onSelectLesson={vi.fn()} />);

    // Check A2 has Certified badge
    const a2Badge = screen.getByTestId('cert-badge-A2');
    expect(a2Badge.textContent).toContain('✓ Certified');

    // Check A1 has lesson progress displayed side-by-side with certification badge
    const a1Badge = screen.getByTestId('cert-badge-A1');
    expect(a1Badge.textContent).toMatch(/Đang học|Sẵn sàng thi|Chưa bắt đầu/);
    expect(screen.getByTestId('journey-milestone-A1').textContent).toContain('bài');
  });

  it('displays distinct level semantics: currentlyLearningLevel vs highestCertifiedLevel', () => {
    const b1Cert: PersistedLevelCertification = {
      level: 'B1',
      certificateId: 'CERT-B1-2026-K9P2',
      certifiedAt: 1712345678000,
      overallScore: 78,
      skillScores: { listening: 80, reading: 80, speaking: 75, writing: 77 },
      attemptId: 'chk_b1_01',
      verifiedVersion: '2026.1',
      criteriaSummary: {
        overallRequired: 75,
        overallAchieved: 78,
        floorRequired: 60,
        minSkillAchieved: 75,
        verifiedVersion: '2026.1',
      },
    };

    useAppStore.setState({
      completedListeningLessonIds: ['listen_1'], // listen_1 is B2 level
      levelCertifications: { B1: b1Cert },
    });

    render(<LearningJourneyProgressionMap onSelectLesson={vi.fn()} />);

    // Header indicators
    const currentIndicator = screen.getByTestId('currently-learning-level-indicator');
    const highestCertIndicator = screen.getByTestId('highest-certified-level-indicator');

    expect(currentIndicator.textContent).toContain('Đang học: B2');
    expect(highestCertIndicator.textContent).toContain('Đạt chuẩn cao nhất: B1 Mastery');
  });

  it('renders neutral state for brand new users (never shows A1 failed or score 0)', () => {
    useAppStore.setState({
      completedListeningLessonIds: [],
      fourSkillsCompletionProgress: { reading: [], speaking: [], writing: [] },
      resumeActivities: {},
      levelCertifications: {},
      checkpointHistory: [],
    });

    render(<LearningJourneyProgressionMap onSelectLesson={vi.fn()} />);

    // New user onboarding card is visible
    expect(screen.getByTestId('new-user-journey-card')).toBeTruthy();
    expect(screen.getByText(/Hành Trình Chinh Phục 4 Kỹ Năng Tiếng Anh/i)).toBeTruthy();

    // Neutral badge on A1, never failed or score 0
    const a1Badge = screen.getByTestId('cert-badge-A1');
    expect(a1Badge.textContent).toContain('Chưa bắt đầu');
    expect(a1Badge.textContent).not.toContain('failed');
    expect(a1Badge.textContent).not.toContain('0%');
  });

  it('does NOT auto-certify returning users who completed all lessons without checkpoint exam', () => {
    useAppStore.setState({
      completedListeningLessonIds: ['listen_a1_1', 'listen_a1_2', 'listen_a1_3', 'listen_a1_4'],
      fourSkillsCompletionProgress: {
        reading: ['read_a1_1', 'read_a1_2', 'read_a1_3', 'read_a1_4'],
        speaking: [],
        writing: [],
      },
      levelCertifications: {}, // Empty
      checkpointHistory: [],
    });

    render(<LearningJourneyProgressionMap onSelectLesson={vi.fn()} />);

    const a1Badge = screen.getByTestId('cert-badge-A1');
    // Invariant: 100% lessons != certified
    expect(a1Badge.textContent).not.toContain('✓ Certified');

    const highestCertIndicator = screen.getByTestId('highest-certified-level-indicator');
    expect(highestCertIndicator.textContent).toContain('Chưa có');
  });

  it('CEFRCertificationHistoryModal renders past attempts with improvement deltas and honest wording', () => {
    const historyEntries: CheckpointHistoryEntry[] = [
      {
        attemptId: 'chk_a2_attempt_1',
        level: 'A2',
        date: 1712000000000,
        result: 'needs_reinforcement',
        isPassed: false,
        overallScore: 65,
        scores: { listening: 70, reading: 65, speaking: 50, writing: 75 },
        policyVersion: '2026.1',
        schemaVersion: 1,
      },
      {
        attemptId: 'chk_a2_attempt_2',
        level: 'A2',
        date: 1712500000000, // Later attempt with improvement
        result: 'certified',
        isPassed: true,
        overallScore: 78,
        scores: { listening: 80, reading: 75, speaking: 72, writing: 85 },
        policyVersion: '2026.1',
        schemaVersion: 1,
        certificateId: 'CERT-A2-2026-X8Y2',
      },
    ];

    const handleClose = vi.fn();
    const handleRetake = vi.fn();

    render(
      <CEFRCertificationHistoryModal
        isOpen={true}
        onClose={handleClose}
        history={historyEntries}
        onSelectRetake={handleRetake}
      />
    );

    // Modal accessibility & semantic heading
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Lịch Sử Kiểm Định CEFR')).toBeTruthy();

    // Latest attempt is certified with honest badge
    expect(screen.getByText(/✓ Đạt chuẩn \(Certified in English Mastery Hub\)/i)).toBeTruthy();
    expect(screen.getByText(/Mã xác thực: CERT-A2-2026-X8Y2/i)).toBeTruthy();

    // Check overall improvement delta (+13% improvement: 78 - 65)
    expect(screen.getByTestId('overall-delta-positive').textContent).toContain('+13% cải thiện');

    // First attempt displays "Lần đầu tiên"
    expect(screen.getByText('Lần đầu tiên')).toBeTruthy();

    // Failed attempt displays Needs Reinforcement badge
    expect(screen.getByText(/Cần củng cố \(Needs Reinforcement\)/i)).toBeTruthy();

    // Honest wording: Never says official CEFR accredited or ETS
    expect(screen.queryByText(/Official CEFR Certificate/i)).toBeNull();
    expect(screen.queryByText(/CEFR Accredited/i)).toBeNull();
  });

  it('CEFRCertificationHistoryModal closes on Esc key press and satisfies touch target sizes', () => {
    const handleClose = vi.fn();

    render(
      <CEFRCertificationHistoryModal
        isOpen={true}
        onClose={handleClose}
        history={[]}
      />
    );

    // Esc key closes modal
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();

    // Close button has min-height >= 44px
    const closeBtn = screen.getByTestId('close-history-modal-btn');
    expect(closeBtn.className).toContain('min-h-[44px]');
  });

  it('opens checkpoint modal when "Làm bài kiểm định" is clicked in Level Detail', async () => {
    // Set A1 as ready
    useAppStore.setState({
      completedListeningLessonIds: ['listen_a1_1', 'listen_a1_2', 'listen_a1_3', 'listen_a1_4'],
    });

    render(<LearningJourneyProgressionMap onSelectLesson={vi.fn()} />);

    // Click on A1 milestone to expand detail
    fireEvent.click(screen.getByTestId('journey-milestone-A1'));

    // Check detail section is expanded
    expect(screen.getByTestId('level-detail-section-A1')).toBeTruthy();

    // Check Level Certification Card is present
    expect(screen.getByTestId('level-certification-card-A1')).toBeTruthy();

    // Check "Lịch sử" button in card opens history modal
    fireEvent.click(screen.getByTestId('btn-view-checkpoint-history'));
    expect(screen.getByTestId('certification-history-modal')).toBeTruthy();
  });
});
