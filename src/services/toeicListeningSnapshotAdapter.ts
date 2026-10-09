// src/services/toeicListeningSnapshotAdapter.ts
import { ToeicExamSnapshot, ToeicQuestion, ToeicQuestionGroup } from '../types/toeic';
import {
  NormalizedListeningDataset,
  NormalizedToeicListeningGroup,
  ToeicListeningQuestion,
} from '../types/toeicListening';
import { normalizeToeicListeningDataset } from './toeicListeningNormalizer';

export interface ListeningSnapshotComposition {
  attemptId: string;
  seed: number;
  listeningGroups: NormalizedToeicListeningGroup[];
  listeningQuestions: ToeicListeningQuestion[];
  audioIdentities: string[];
  audioIdentityToQuestions: Map<string, string[]>;
  questionToAudioIdentity: Map<string, string>;
}

/**
 * Adapter chuẩn hóa cho ToeicExamSnapshot:
 * Chuyển đổi một snapshot bài thi thành thành phần Listening hướng Nhóm
 * có tính tất định (Deterministic) 100%.
 *
 * Invariant bảo đảm:
 * - Same Attempt -> Same Groups -> Same Questions.
 * - Không regenerate hay xáo trộn thứ tự sau khi reload trang (F5).
 * - Cung cấp ánh xạ 2 chiều giữa Question ID và Audio Identity để phục vụ
 *   cơ chế khóa bài nghe 1 lần của Mock Exam ETS mà không bị exploit.
 */
export function extractListeningFromSnapshot(
  snapshot: ToeicExamSnapshot
): ListeningSnapshotComposition {
  const listeningQuestions = (snapshot.questions || []).filter(
    (q) =>
      q.part === 'part1_photos' ||
      q.part === 'part2_qna' ||
      q.part === 'part3_conv' ||
      q.part === 'part4_talks'
  );

  const listeningGroups = (snapshot.groups || []).filter(
    (g) => g.part === 'part3_conv' || g.part === 'part4_talks'
  );

  // Chuẩn hóa snapshot cục bộ
  const normalized: NormalizedListeningDataset = normalizeToeicListeningDataset(
    listeningQuestions,
    listeningGroups
  );

  const audioIdentities: string[] = [];
  const audioIdentityToQuestions = new Map<string, string[]>();
  const questionToAudioIdentity = new Map<string, string>();

  // Thu thập danh sách audioIdentities theo đúng thứ tự xuất hiện của groups
  for (const group of normalized.groups) {
    if (!audioIdentities.includes(group.audioGroupId)) {
      audioIdentities.push(group.audioGroupId);
    }

    audioIdentityToQuestions.set(group.audioGroupId, [...group.questionIds]);

    for (const qId of group.questionIds) {
      questionToAudioIdentity.set(qId, group.audioGroupId);
    }
  }

  return {
    attemptId: snapshot.id,
    seed: snapshot.seed,
    listeningGroups: normalized.groups,
    listeningQuestions: normalized.questions,
    audioIdentities,
    audioIdentityToQuestions,
    questionToAudioIdentity,
  };
}

/**
 * Tra cứu Audio Identity tương ứng với một Question ID trong cấu trúc Snapshot
 */
export function getAudioIdentityForQuestion(
  questionId: string,
  composition: ListeningSnapshotComposition
): string | undefined {
  return composition.questionToAudioIdentity.get(questionId);
}
