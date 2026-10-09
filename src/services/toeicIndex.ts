// src/services/toeicIndex.ts
import {
  ToeicQuestion,
  ToeicQuestionGroup,
  ToeicPart,
  ToeicSkill,
  ToeicDifficulty,
} from '../types/toeic';
import {
  TOEIC_QUESTION_BANK,
  TOEIC_QUESTION_GROUPS,
} from '../data/toeicQuestionsData';

export interface ToeicQuestionFilter {
  part?: ToeicPart;
  skill?: ToeicSkill;
  difficulty?: ToeicDifficulty;
  topic?: string;
  hasGroup?: boolean;
}

export interface ToeicGroupFilter {
  part?: ToeicPart;
  skill?: ToeicSkill;
  difficulty?: ToeicDifficulty;
  topic?: string;
}

export interface ToeicIndexStats {
  totalQuestions: number;
  totalGroups: number;
  partCounts: Record<ToeicPart, number>;
  skillCounts: Record<ToeicSkill, number>;
  difficultyCounts: Record<ToeicDifficulty, number>;
  groupPartCounts: Partial<Record<ToeicPart, number>>;
}

/**
 * Lớp chỉ mục tra cứu hiệu năng cao cho TOEIC Question Bank (O(1) Map lookups).
 * Không persist vào localStorage / Zustand để tránh ô nhiễm bộ nhớ.
 */
export class ToeicQuestionIndex {
  private questionsById = new Map<string, ToeicQuestion>();
  private questionsByPart = new Map<ToeicPart, ToeicQuestion[]>();
  private questionsBySkill = new Map<ToeicSkill, ToeicQuestion[]>();
  private questionsByDifficulty = new Map<ToeicDifficulty, ToeicQuestion[]>();
  private questionsByGroupId = new Map<string, ToeicQuestion[]>();
  private questionToGroup = new Map<string, ToeicQuestionGroup>();

  private groupsById = new Map<string, ToeicQuestionGroup>();
  private groupsByPart = new Map<ToeicPart, ToeicQuestionGroup[]>();
  private groupsByDifficulty = new Map<ToeicDifficulty, ToeicQuestionGroup[]>();

  private isInitialized = false;

  constructor() {
    this.buildIndex(TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS);
  }

  /**
   * Khởi tạo hoặc cập nhật lại cấu trúc chỉ mục từ nguồn dữ liệu
   */
  public buildIndex(questions: ToeicQuestion[], groups: ToeicQuestionGroup[]): void {
    this.clear();

    // 1. Index groups
    groups.forEach((g) => {
      this.groupsById.set(g.id, g);

      if (!this.groupsByPart.has(g.part)) {
        this.groupsByPart.set(g.part, []);
      }
      this.groupsByPart.get(g.part)!.push(g);

      if (g.difficulty) {
        if (!this.groupsByDifficulty.has(g.difficulty)) {
          this.groupsByDifficulty.set(g.difficulty, []);
        }
        this.groupsByDifficulty.get(g.difficulty)!.push(g);
      }
    });

    // 2. Index questions
    questions.forEach((q) => {
      this.questionsById.set(q.id, q);

      // Theo Part
      if (!this.questionsByPart.has(q.part)) {
        this.questionsByPart.set(q.part, []);
      }
      this.questionsByPart.get(q.part)!.push(q);

      // Theo Skill
      if (!this.questionsBySkill.has(q.skill)) {
        this.questionsBySkill.set(q.skill, []);
      }
      this.questionsBySkill.get(q.skill)!.push(q);

      // Theo Difficulty
      if (q.difficulty) {
        if (!this.questionsByDifficulty.has(q.difficulty)) {
          this.questionsByDifficulty.set(q.difficulty, []);
        }
        this.questionsByDifficulty.get(q.difficulty)!.push(q);
      }

      // Theo Group
      if (q.groupId) {
        if (!this.questionsByGroupId.has(q.groupId)) {
          this.questionsByGroupId.set(q.groupId, []);
        }
        this.questionsByGroupId.get(q.groupId)!.push(q);

        const parentGroup = this.groupsById.get(q.groupId);
        if (parentGroup) {
          this.questionToGroup.set(q.id, parentGroup);
        }
      }
    });

    // 3. Reverse map cho các group có questionIds
    groups.forEach((g) => {
      g.questionIds.forEach((qId) => {
        if (!this.questionToGroup.has(qId)) {
          this.questionToGroup.set(qId, g);
        }
      });
    });

    this.isInitialized = true;
  }

  private clear(): void {
    this.questionsById.clear();
    this.questionsByPart.clear();
    this.questionsBySkill.clear();
    this.questionsByDifficulty.clear();
    this.questionsByGroupId.clear();
    this.questionToGroup.clear();

    this.groupsById.clear();
    this.groupsByPart.clear();
    this.groupsByDifficulty.clear();
  }

  // --- QUERY APIS ---

  public getQuestionById(id: string): ToeicQuestion | undefined {
    return this.questionsById.get(id);
  }

  public getGroupById(id: string): ToeicQuestionGroup | undefined {
    return this.groupsById.get(id);
  }

  public getQuestionsByPart(part: ToeicPart): ToeicQuestion[] {
    return this.questionsByPart.get(part) || [];
  }

  public getQuestionsBySkill(skill: ToeicSkill): ToeicQuestion[] {
    return this.questionsBySkill.get(skill) || [];
  }

  public getQuestionsByDifficulty(diff: ToeicDifficulty): ToeicQuestion[] {
    return this.questionsByDifficulty.get(diff) || [];
  }

  public getGroupsByPart(part: ToeicPart): ToeicQuestionGroup[] {
    return this.groupsByPart.get(part) || [];
  }

  public getQuestionsByGroupId(groupId: string): ToeicQuestion[] {
    const directQuestions = this.questionsByGroupId.get(groupId);
    if (directQuestions && directQuestions.length > 0) {
      return directQuestions;
    }

    const group = this.groupsById.get(groupId);
    if (!group) return [];

    return group.questionIds
      .map((id) => this.questionsById.get(id))
      .filter((q): q is ToeicQuestion => Boolean(q));
  }

  public getGroupByQuestionId(questionId: string): ToeicQuestionGroup | undefined {
    return this.questionToGroup.get(questionId);
  }

  /**
   * Lọc câu hỏi linh hoạt có sử dụng chỉ mục tăng tốc
   */
  public queryQuestions(filter: ToeicQuestionFilter): ToeicQuestion[] {
    let pool: ToeicQuestion[];

    // Khởi tạo pool bằng chỉ mục hẹp nhất
    if (filter.part) {
      pool = this.getQuestionsByPart(filter.part);
    } else if (filter.skill) {
      pool = this.getQuestionsBySkill(filter.skill);
    } else if (filter.difficulty) {
      pool = this.getQuestionsByDifficulty(filter.difficulty);
    } else {
      pool = Array.from(this.questionsById.values());
    }

    // Lọc tiếp các tiêu chí còn lại
    return pool.filter((q) => {
      if (filter.part && q.part !== filter.part) return false;
      if (filter.skill && q.skill !== filter.skill) return false;
      if (filter.difficulty && q.difficulty !== filter.difficulty) return false;
      if (filter.topic && q.topic && !q.topic.toLowerCase().includes(filter.topic.toLowerCase())) {
        return false;
      }
      if (filter.hasGroup !== undefined) {
        const hasGrp = Boolean(q.groupId || this.questionToGroup.has(q.id));
        if (hasGrp !== filter.hasGroup) return false;
      }
      return true;
    });
  }

  /**
   * Lọc nhóm câu hỏi linh hoạt có sử dụng chỉ mục tăng tốc
   */
  public queryGroups(filter: ToeicGroupFilter): ToeicQuestionGroup[] {
    let pool: ToeicQuestionGroup[];

    if (filter.part) {
      pool = this.getGroupsByPart(filter.part);
    } else if (filter.difficulty && this.groupsByDifficulty.has(filter.difficulty)) {
      pool = this.groupsByDifficulty.get(filter.difficulty) || [];
    } else {
      pool = Array.from(this.groupsById.values());
    }

    return pool.filter((g) => {
      if (filter.part && g.part !== filter.part) return false;
      if (filter.skill && g.skill !== filter.skill) return false;
      if (filter.difficulty && g.difficulty !== filter.difficulty) return false;
      if (filter.topic && g.topic && !g.topic.toLowerCase().includes(filter.topic.toLowerCase())) {
        return false;
      }
      return true;
    });
  }

  /**
   * Thống kê toàn cảnh ngân hàng câu hỏi
   */
  public getStats(): ToeicIndexStats {
    const partCounts: Record<ToeicPart, number> = {
      part1_photos: 0,
      part2_qna: 0,
      part3_conv: 0,
      part4_talks: 0,
      part5_grammar: 0,
      part6_text: 0,
      part7_reading: 0,
      speaking_read: 0,
      writing_email: 0,
    };

    const skillCounts: Record<ToeicSkill, number> = {
      listening: 0,
      reading: 0,
      speaking: 0,
      writing: 0,
    };

    const difficultyCounts: Record<ToeicDifficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    this.questionsById.forEach((q) => {
      if (q.part in partCounts) partCounts[q.part]++;
      if (q.skill in skillCounts) skillCounts[q.skill]++;
      if (q.difficulty && q.difficulty in difficultyCounts) {
        difficultyCounts[q.difficulty]++;
      }
    });

    const groupPartCounts: Partial<Record<ToeicPart, number>> = {};
    this.groupsById.forEach((g) => {
      groupPartCounts[g.part] = (groupPartCounts[g.part] || 0) + 1;
    });

    return {
      totalQuestions: this.questionsById.size,
      totalGroups: this.groupsById.size,
      partCounts,
      skillCounts,
      difficultyCounts,
      groupPartCounts,
    };
  }
}

// Singleton Index Instance
export const toeicQuestionIndex = new ToeicQuestionIndex();
