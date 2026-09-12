<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { EChartsOption } from "echarts";
import ChartPanel from "@/components/ChartPanel.vue";
import {
  dimensionMeta,
  dimensions,
  questions,
  scaleLabels,
} from "@/data/questions";
import {
  adminSignIn,
  completeSession,
  fetchDashboardData,
  hasSupabaseAdminSession,
  isSupabaseConfigured,
  startSession,
  submitFeedback,
} from "@/services/assessmentRepository";
import { buildDashboardStats } from "@/utils/analytics";
import { assessDataQuality } from "@/utils/dataQuality";
import { calculateDimensionScores, isComplete } from "@/utils/scoring";
import type {
  AnswerMap,
  AssessmentSession,
  DashboardData,
  Dimension,
  LikertScore,
  PilotFeedback,
} from "@/types";

const route = useRoute();
const router = useRouter();
const answers = ref<AnswerMap>({});
const currentIndex = ref(0);
const consentChecked = ref(false);
const currentSession = ref<AssessmentSession | null>(null);
const submitError = ref("");
const saving = ref(false);
const feedbackSaved = ref(false);
const feedback = ref<PilotFeedback>({
  questionsClear: 3,
  platformEasy: 3,
  resultClear: 3,
  lengthAppropriate: 3,
  confusingPart: "",
  improvement: "",
});
const dashboard = ref<DashboardData>({
  sessions: [],
  source: isSupabaseConfigured ? "supabase" : "local",
});
const dashboardError = ref("");
const dashboardLoading = ref(false);
const adminAuthorized = ref(false);
const adminEmail = ref("");
const adminPassword = ref("");
const adminError = ref("");
const excludeLikelyInvalid = ref(false);
const personalityDimensions = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism",
] as Dimension[];
const attitudeDimensions = [
  "aiBenefit",
  "aiConcern",
  "aiAgency",
] as Dimension[];

const currentQuestion = computed(() => questions[currentIndex.value]);
const answeredCount = computed(() => Object.keys(answers.value).length);
const completionPercent = computed(() =>
  Math.round((answeredCount.value / questions.length) * 100),
);
const complete = computed(() => isComplete(answers.value));
const scores = computed(() => calculateDimensionScores(answers.value));
const hasResult = computed(() => currentSession.value?.status === "completed");
const qualityStats = computed(() => buildDashboardStats(dashboard.value));
const dashboardStats = computed(() =>
  buildDashboardStats(dashboard.value, {
    excludeLikelyInvalid: excludeLikelyInvalid.value,
  }),
);
const adminUsesSupabase = computed(() => isSupabaseConfigured);
const percent = (score: number) => String(((score - 1) / 4) * 100) + "%";

const personalityChart = computed<EChartsOption>(() => ({
  tooltip: { trigger: "item" },
  radar: {
    indicator: personalityDimensions.map((dimension) => ({
      name: dimensionMeta[dimension].shortName,
      max: 5,
    })),
    radius: "63%",
    splitNumber: 5,
  },
  series: [
    {
      type: "radar",
      data: [
        {
          value: personalityDimensions.map(
            (dimension) => scores.value[dimension],
          ),
          name: "本次回答",
        },
      ],
      areaStyle: { color: "rgba(34, 108, 117, 0.25)" },
      lineStyle: { color: "#226c75" },
      itemStyle: { color: "#b64c3e" },
    },
  ],
}));
const attitudeChart = computed<EChartsOption>(() => ({
  grid: { left: 22, right: 20, top: 22, bottom: 30, containLabel: true },
  xAxis: { type: "value", min: 1, max: 5, interval: 1 },
  yAxis: {
    type: "category",
    data: attitudeDimensions.map(
      (dimension) => dimensionMeta[dimension].shortName,
    ),
  },
  series: [
    {
      type: "bar",
      data: attitudeDimensions.map((dimension) => scores.value[dimension]),
      barMaxWidth: 30,
      itemStyle: { color: "#b64c3e", borderRadius: [0, 4, 4, 0] },
    },
  ],
}));
const dashboardDistributionChart = computed<EChartsOption>(() => ({
  tooltip: { trigger: "axis" },
  legend: { data: ["1 分", "2 分", "3 分", "4 分", "5 分"] },
  grid: { left: 36, right: 20, top: 46, bottom: 28, containLabel: true },
  xAxis: {
    type: "category",
    data: dashboardStats.value.items.map((item) => item.question.id),
  },
  yAxis: { type: "value", minInterval: 1 },
  series: [1, 2, 3, 4, 5].map((score, index) => ({
    type: "bar",
    name: String(score) + " 分",
    stack: "responses",
    data: dashboardStats.value.items.map((item) => item.distribution[index]),
  })),
}));

function level(score: number) {
  return score >= 3.7 ? "较高" : score <= 2.4 ? "较低" : "中等";
}
function interpretation(dimension: Dimension, score: number) {
  return score >= 3.7
    ? dimensionMeta[dimension].high
    : score <= 2.4
      ? dimensionMeta[dimension].low
      : "本次回答显示该倾向处于中间区间，可能会随情境和任务类型变化。";
}

async function beginAssessment() {
  if (!consentChecked.value) return;
  submitError.value = "";
  saving.value = true;
  try {
    currentSession.value = await startSession();
    answers.value = {};
    currentIndex.value = 0;
    feedbackSaved.value = false;
    await router.push("/assessment");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知错误";
    submitError.value = "无法创建匿名测评会话：" + detail;
  } finally {
    saving.value = false;
  }
}
function chooseAnswer(value: number) {
  answers.value = {
    ...answers.value,
    [currentQuestion.value.id]: value as LikertScore,
  };
  if (currentIndex.value < questions.length - 1) currentIndex.value += 1;
}
async function finishAssessment() {
  if (!complete.value) {
    currentIndex.value = questions.findIndex(
      (question) => answers.value[question.id] === undefined,
    );
    return;
  }
  if (!currentSession.value) {
    submitError.value = "本次会话已失效，请重新开始测评。";
    await router.push("/");
    return;
  }
  saving.value = true;
  submitError.value = "";
  try {
    const completedAt = new Date().toISOString();
    const duration = Math.max(
      0,
      Math.round(
        (Date.now() - new Date(currentSession.value.startedAt).getTime()) /
          1000,
      ),
    );
    currentSession.value = await completeSession({
      ...currentSession.value,
      answers: { ...answers.value },
      scores: scores.value,
      completedAt,
      completionSeconds: duration,
      status: "completed",
    });
    await router.push("/results/" + currentSession.value.id);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知错误";
    submitError.value = "提交时发生错误：" + detail;
  } finally {
    saving.value = false;
  }
}
async function saveFeedback() {
  if (!currentSession.value) return;
  saving.value = true;
  try {
    await submitFeedback(
      currentSession.value.id,
      feedback.value,
      currentSession.value.dataSource,
    );
    currentSession.value = {
      ...currentSession.value,
      feedback: { ...feedback.value, submittedAt: new Date().toISOString() },
    };
    feedbackSaved.value = true;
  } finally {
    saving.value = false;
  }
}
async function checkAdmin() {
  if (sessionStorage.getItem("assessment-demo-admin") === "true")
    adminAuthorized.value = true;
  if (adminUsesSupabase.value)
    adminAuthorized.value = await hasSupabaseAdminSession();
  if (adminAuthorized.value) await loadDashboard();
}
async function signInAdmin() {
  adminError.value = "";
  try {
    if (adminUsesSupabase.value)
      await adminSignIn(adminEmail.value, adminPassword.value);
    else if (
      !import.meta.env.VITE_ADMIN_PASSWORD ||
      adminPassword.value !== import.meta.env.VITE_ADMIN_PASSWORD
    )
      throw new Error("演示密码不正确，或尚未配置 VITE_ADMIN_PASSWORD。");
    else sessionStorage.setItem("assessment-demo-admin", "true");
    adminAuthorized.value = true;
    await loadDashboard();
  } catch (error) {
    adminError.value = error instanceof Error ? error.message : "登录失败。";
  }
}
async function loadDashboard() {
  dashboardLoading.value = true;
  dashboardError.value = "";
  try {
    dashboard.value = await fetchDashboardData();
  } catch (error) {
    dashboardError.value =
      error instanceof Error ? error.message : "无法加载研究数据。";
  } finally {
    dashboardLoading.value = false;
  }
}
function csvCell(value: unknown) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}
function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function exportJson() {
  download(
    "assessment-pilot-export.json",
    JSON.stringify(exportableSessions(), null, 2),
    "application/json",
  );
}
function exportCsv() {
  const headers = [
    "anonymous_session_id",
    "started_at",
    "completed_at",
    "completion_seconds",
    "status",
    ...questions.map((question) => question.id),
    ...dimensions,
    "questions_clear",
    "platform_easy",
    "result_clear",
    "length_appropriate",
    "confusing_part",
    "improvement",
    "quality_level",
    "quality_score",
    "quality_reasons",
  ];
  const rows = dashboard.value.sessions.map((session) =>
    (() => {
      const quality =
        session.status === "completed"
          ? assessDataQuality(session.answers, session.completionSeconds)
          : null;
      return [
        session.id,
        session.startedAt,
        session.completedAt,
        session.completionSeconds,
        session.status,
        ...questions.map((question) => session.answers[question.id]),
        ...dimensions.map((dimension) => session.scores[dimension]),
        session.feedback?.questionsClear,
        session.feedback?.platformEasy,
        session.feedback?.resultClear,
        session.feedback?.lengthAppropriate,
        session.feedback?.confusingPart,
        session.feedback?.improvement,
        quality?.level,
        quality?.score,
        quality?.reasons.join(" | "),
      ];
    })()
      .map(csvCell)
      .join(","),
  );
  download(
    "assessment-pilot-export.csv",
    [headers.map(csvCell).join(","), ...rows].join("\n"),
    "text/csv;charset=utf-8",
  );
}
function exportableSessions() {
  return dashboard.value.sessions.map((session) => {
    const quality =
      session.status === "completed"
        ? assessDataQuality(session.answers, session.completionSeconds)
        : null;
    return {
      ...session,
      quality_level: quality?.level ?? null,
      quality_score: quality?.score ?? null,
      quality_reasons: quality?.reasons ?? [],
    };
  });
}
function formattedDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "-";
}
onMounted(async () => {
  if (route.path === "/admin") await checkAdmin();
});
</script>

<template>
  <main class="page-shell">
    <header class="site-header">
      <RouterLink class="brand" to="/"
        ><span>Agentic AI Web Assessment</span>
        <h1>人格与 AI 学习态度测评</h1></RouterLink
      ><RouterLink class="research-link" to="/admin">研究者入口</RouterLink>
    </header>
    <section v-if="route.path === '/'" class="intro-layout">
      <article class="consent-panel">
        <p class="section-kicker">Introduction & Consent</p>
        <h2>用于教育与研究探索的匿名测评</h2>
        <p>
          本项目研究 Big Five 人格倾向与 AI
          学习态度之间的探索性关系。平台只收集随机生成的匿名会话
          ID、答题分数、开始/完成时间、完成时长及可选试测反馈。
        </p>
        <p>
          数据仅用于课程项目的 pilot
          analysis、功能验证和研究报告；不收集姓名、手机号、学号、邮箱、IP
          或其他直接身份信息。本测评不是医学、临床或心理诊断，也不应用于筛选或重要决策。
        </p>
        <label class="consent-check"
          ><input v-model="consentChecked" type="checkbox" /><span
            >我已理解测评目的、匿名数据用途及非诊断性质，并自愿同意参与。</span
          ></label
        >
        <p v-if="submitError" class="form-error">{{ submitError }}</p>
        <button
          class="primary-button"
          type="button"
          :disabled="!consentChecked || saving"
          @click="beginAssessment"
        >
          {{ saving ? "正在创建会话…" : "同意并开始测评" }}
        </button>
      </article>
      <aside class="overview-panel" aria-label="测评概览">
        <div class="overview-card">
          <strong>{{ questions.length }}</strong
          ><span>总题目</span>
        </div>
        <div class="overview-card">
          <strong>20</strong><span>Big Five 简化题项</span>
        </div>
        <div class="overview-card">
          <strong>9</strong><span>探索性 AI 态度题</span>
        </div>
        <div class="overview-card">
          <strong>1–5</strong><span>Likert 评分</span>
        </div>
      </aside>
    </section>
    <section v-else-if="route.path === '/assessment'" class="quiz-view">
      <div class="quiz-topline">
        <div>
          <p class="section-kicker">
            {{
              currentQuestion.section === "personality"
                ? "Big Five 人格测评"
                : "AI 学习态度测评"
            }}
          </p>
          <h2>{{ currentQuestion.text }}</h2>
        </div>
        <strong>{{ currentIndex + 1 }} / {{ questions.length }}</strong>
      </div>
      <div class="progress-track" aria-label="完成进度">
        <span :style="{ width: String(completionPercent) + '%' }"></span>
      </div>
      <nav class="question-nav" aria-label="题目导航">
        <button
          v-for="(question, index) in questions"
          :key="question.id"
          :class="{
            active: currentIndex === index,
            done: answers[question.id] !== undefined,
          }"
          type="button"
          @click="currentIndex = index"
        >
          {{ index + 1 }}
        </button>
      </nav>
      <article class="question-panel">
        <span class="dimension-chip">{{
          dimensionMeta[currentQuestion.dimension].name
        }}</span>
        <div class="likert-grid" role="group" aria-label="五点评分">
          <button
            v-for="(label, index) in scaleLabels"
            :key="label"
            :class="{ selected: answers[currentQuestion.id] === index + 1 }"
            type="button"
            @click="chooseAnswer(index + 1)"
          >
            <strong>{{ index + 1 }}</strong
            ><span>{{ label }}</span>
          </button>
        </div>
        <p class="scoring-note">
          所有题目均为必答；反向题会以 6 - 原始分数自动计分。
        </p>
      </article>
      <p v-if="submitError" class="form-error">{{ submitError }}</p>
      <div class="quiz-actions">
        <button
          class="ghost-button"
          type="button"
          :disabled="currentIndex === 0"
          @click="currentIndex -= 1"
        >
          上一题</button
        ><button
          class="ghost-button"
          type="button"
          :disabled="currentIndex === questions.length - 1"
          @click="currentIndex += 1"
        >
          下一题</button
        ><button
          class="primary-button"
          type="button"
          :disabled="!complete || saving"
          @click="finishAssessment"
        >
          {{ saving ? "正在提交…" : "提交并查看结果" }}
        </button>
      </div>
    </section>
    <section v-else-if="route.path.startsWith('/results')" class="results-view">
      <template v-if="hasResult">
        <div class="result-hero">
          <p class="section-kicker">Participant Results</p>
          <h2>本次回答的倾向摘要</h2>
          <p>
            结果仅供教育和研究探索，不构成心理、医学或临床诊断。得分范围为
            1–5，越高表示本次回答中该维度倾向越明显。
          </p>
        </div>
        <div class="chart-grid">
          <article class="chart-card">
            <h3>Big Five 雷达图</h3>
            <ChartPanel
              :option="personalityChart"
              label="Big Five 得分雷达图"
            />
          </article>
          <article class="chart-card">
            <h3>AI 态度条形图</h3>
            <ChartPanel :option="attitudeChart" label="AI 学习态度得分条形图" />
          </article>
        </div>
        <section class="result-section">
          <h3>Big Five 人格倾向</h3>
          <div class="dimension-list">
            <article
              v-for="dimension in personalityDimensions"
              :key="dimension"
              class="dimension-card"
            >
              <div class="dimension-heading">
                <div>
                  <h3>{{ dimensionMeta[dimension].name }}</h3>
                  <p>{{ dimensionMeta[dimension].description }}</p>
                </div>
                <strong>{{ scores[dimension].toFixed(2) }}</strong>
              </div>
              <div class="score-bar">
                <span :style="{ width: percent(scores[dimension]) }"></span>
              </div>
              <p>
                <b>{{ level(scores[dimension]) }}</b
                >：{{ interpretation(dimension, scores[dimension]) }}
              </p>
            </article>
          </div>
        </section>
        <section class="result-section">
          <h3>AI 学习态度倾向</h3>
          <div class="dimension-list three">
            <article
              v-for="dimension in attitudeDimensions"
              :key="dimension"
              class="dimension-card"
            >
              <div class="dimension-heading">
                <div>
                  <h3>{{ dimensionMeta[dimension].name }}</h3>
                  <p>{{ dimensionMeta[dimension].description }}</p>
                </div>
                <strong>{{ scores[dimension].toFixed(2) }}</strong>
              </div>
              <div class="score-bar">
                <span :style="{ width: percent(scores[dimension]) }"></span>
              </div>
              <p>
                <b>{{ level(scores[dimension]) }}</b
                >：{{ interpretation(dimension, scores[dimension]) }}
              </p>
            </article>
          </div>
        </section>
        <section class="feedback-panel">
          <div>
            <p class="section-kicker">Pilot Feedback</p>
            <h3>帮助我们改进这次试测</h3>
            <p>反馈与匿名会话 ID 关联，不要求填写任何身份信息。</p>
          </div>
          <div class="feedback-grid">
            <label
              >题目容易理解<select v-model.number="feedback.questionsClear">
                <option v-for="number in 5" :key="number" :value="number">
                  {{ number }}
                </option>
              </select></label
            ><label
              >平台容易使用<select v-model.number="feedback.platformEasy">
                <option v-for="number in 5" :key="number" :value="number">
                  {{ number }}
                </option>
              </select></label
            ><label
              >结果解释容易理解<select v-model.number="feedback.resultClear">
                <option v-for="number in 5" :key="number" :value="number">
                  {{ number }}
                </option>
              </select></label
            ><label
              >测评长度合适<select v-model.number="feedback.lengthAppropriate">
                <option v-for="number in 5" :key="number" :value="number">
                  {{ number }}
                </option>
              </select></label
            >
          </div>
          <label class="text-feedback"
            >哪些题目或部分令人困惑？<textarea
              v-model.trim="feedback.confusingPart"
              maxlength="500"
            ></textarea></label
          ><label class="text-feedback"
            >你会如何改进本平台？<textarea
              v-model.trim="feedback.improvement"
              maxlength="500"
            ></textarea></label
          ><button
            class="primary-button"
            type="button"
            :disabled="saving || feedbackSaved"
            @click="saveFeedback"
          >
            {{ feedbackSaved ? "反馈已匿名保存" : "提交匿名反馈" }}
          </button>
        </section>
        <div class="result-actions">
          <RouterLink class="primary-button link-button" to="/"
            >开始新测评</RouterLink
          >
        </div>
      </template>
      <article v-else class="consent-panel">
        <h2>结果会话不可用</h2>
        <p>请从首页重新开始一次匿名测评。</p>
        <RouterLink class="primary-button link-button" to="/"
          >返回首页</RouterLink
        >
      </article>
    </section>
    <section v-else class="admin-view">
      <template v-if="!adminAuthorized"
        ><article class="admin-login">
          <p class="section-kicker">Researcher Access</p>
          <h2>研究者面板</h2>
          <p v-if="adminUsesSupabase">
            使用 Supabase Auth 的研究者账号登录。参与者不能读取聚合数据。
          </p>
          <p v-else>
            当前未配置 Supabase。可用 VITE_ADMIN_PASSWORD
            开启仅供本地演示的前端密码门禁，它不是安全认证方案。
          </p>
          <label v-if="adminUsesSupabase"
            >邮箱<input
              v-model.trim="adminEmail"
              type="email"
              autocomplete="username" /></label
          ><label
            >密码<input
              v-model="adminPassword"
              type="password"
              autocomplete="current-password"
          /></label>
          <p v-if="adminError" class="form-error">{{ adminError }}</p>
          <button class="primary-button" type="button" @click="signInAdmin">
            登录
          </button>
        </article></template
      >
      <template v-else
        ><div class="admin-hero">
          <div>
            <p class="section-kicker">Researcher Dashboard</p>
            <h2>聚合数据与试测质量检查</h2>
            <p>
              数据源：{{
                dashboard.source === "supabase"
                  ? "Supabase 共享数据库"
                  : "本地开发回退存储"
              }}。Cronbach's alpha
              与相关只作探索性描述，不构成正式心理测量验证。
            </p>
          </div>
          <div class="admin-actions">
            <button
              class="ghost-button"
              type="button"
              :disabled="dashboardLoading"
              @click="loadDashboard"
            >
              刷新</button
            ><button
              class="ghost-button"
              type="button"
              :disabled="!dashboard.sessions.length"
              @click="exportCsv"
            >
              导出 CSV</button
            ><button
              class="ghost-button"
              type="button"
              :disabled="!dashboard.sessions.length"
              @click="exportJson"
            >
              导出 JSON
            </button>
          </div>
        </div>
        <p v-if="dashboardError" class="form-error">{{ dashboardError }}</p>
        <div class="stat-grid">
          <article class="stat-card">
            <strong>{{ dashboardStats.participantCount }}</strong
            ><span>匿名参与者</span>
          </article>
          <article class="stat-card">
            <strong>{{ dashboardStats.completedCount }}</strong
            ><span>已完成</span>
          </article>
          <article class="stat-card">
            <strong>{{ dashboardStats.completionRate }}%</strong
            ><span>完成率</span>
          </article>
          <article class="stat-card">
            <strong>{{ dashboardStats.averageCompletionSeconds || "-" }}</strong
            ><span>平均完成秒数</span>
          </article>
        </div>
        <section class="admin-section data-quality-section">
          <div class="quality-heading">
            <div>
              <h3>Data Quality</h3>
              <p class="method-note">
                仅用于 pilot 阶段的筛查标记，不会删除或修改参与者数据。
              </p>
            </div>
            <label class="quality-filter">
              <input v-model="excludeLikelyInvalid" type="checkbox" />
              <span>Exclude likely invalid</span>
            </label>
          </div>
          <div class="quality-summary">
            <span class="quality-status normal"
              >normal {{ qualityStats.qualitySummary.normal }}</span
            >
            <span class="quality-status review"
              >review {{ qualityStats.qualitySummary.review }}</span
            >
            <span class="quality-status likely-invalid"
              >likely_invalid
              {{ qualityStats.qualitySummary.likely_invalid }}</span
            >
          </div>
          <p v-if="excludeLikelyInvalid" class="method-note">
            当前聚合统计已排除
            {{ qualityStats.qualitySummary.likely_invalid }} 位 likely_invalid
            参与者；review 仍被保留。
          </p>
        </section>
        <section class="admin-section">
          <h3>维度均值与探索性 alpha</h3>
          <p class="method-note">
            样本少于 10 人时，alpha
            和相关均不稳定；本项目不将它们作为正式量表验证。
          </p>
          <div class="admin-bars">
            <div
              v-for="item in dashboardStats.averages"
              :key="item.dimension"
              class="admin-bar-row"
            >
              <div class="admin-bar-label">
                <strong>{{ dimensionMeta[item.dimension].name }}</strong
                ><span
                  >均值 {{ item.average || "-" }} · alpha
                  {{ item.alpha ?? "样本不足" }}</span
                >
              </div>
              <div class="score-bar compact">
                <span
                  :style="{
                    width: item.average ? percent(item.average) : '0%',
                  }"
                ></span>
              </div>
            </div>
          </div>
        </section>
        <section class="admin-section">
          <h3>题目反应分布</h3>
          <ChartPanel
            :option="dashboardDistributionChart"
            label="每道题的 1 到 5 分回答分布"
          />
        </section>
        <section class="admin-section">
          <h3>探索性关联</h3>
          <p>
            开放性与 AI 学习收益感：<b>{{
              dashboardStats.correlation ?? "样本或方差不足"
            }}</b
            >（n={{ dashboardStats.correlationN }}）。这只是 exploratory
            association，不表示因果关系。
          </p>
        </section>
        <section class="admin-section">
          <h3>Pilot feedback</h3>
          <div class="feedback-summary">
            <span
              >题目清晰
              {{ dashboardStats.feedbackAverages.questionsClear || "-" }}</span
            ><span
              >平台易用
              {{ dashboardStats.feedbackAverages.platformEasy || "-" }}</span
            ><span
              >结果清晰
              {{ dashboardStats.feedbackAverages.resultClear || "-" }}</span
            ><span
              >长度合适
              {{
                dashboardStats.feedbackAverages.lengthAppropriate || "-"
              }}</span
            >
          </div>
          <div class="feedback-notes">
            <article
              v-for="entry in dashboardStats.feedbackRecords"
              :key="entry.sessionId"
            >
              <header>
                <strong>匿名会话 {{ entry.sessionId.slice(0, 8) }}</strong>
                <span
                  >{{ formattedDate(entry.submittedAt ?? entry.completedAt) }} ·
                  {{ entry.completionSeconds ?? "-" }} 秒</span
                >
              </header>
              <p>
                <b>困惑：</b>{{ entry.confusingPart || "未填写" }}<br /><b
                  >建议：</b
                >{{ entry.improvement || "未填写" }}
              </p>
            </article>
            <p v-if="!dashboardStats.feedbackRecords.length">暂无试测反馈。</p>
          </div>
        </section>
        <section class="admin-section">
          <h3>最近匿名提交</h3>
          <div class="submission-list">
            <article v-for="record in dashboardStats.recent" :key="record.id">
              <div>
                <strong>{{ record.id.slice(0, 8) }}</strong>
                <span
                  >{{ formattedDate(record.completedAt ?? record.startedAt) }} ·
                  {{ record.status }} ·
                  {{ record.completionSeconds ?? "-" }} 秒</span
                >
              </div>
              <div v-if="record.quality" class="quality-record">
                <span :class="['quality-status', record.quality.level]">
                  {{ record.quality.level }} · {{ record.quality.score }}
                </span>
                <small>{{
                  record.quality.reasons.join("；") || "未触发风险点"
                }}</small>
              </div>
            </article>
            <p v-if="!dashboardStats.recent.length" class="empty-state">
              还没有收集到数据。
            </p>
          </div>
        </section>
      </template>
    </section>
  </main>
</template>
