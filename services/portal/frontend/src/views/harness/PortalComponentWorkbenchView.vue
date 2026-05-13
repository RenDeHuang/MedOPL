<template>
  <main class="min-h-screen bg-slate-50 px-4 py-6 text-gray-900 dark:bg-slate-950 dark:text-gray-100 lg:px-8">
    <section data-route-id="portal-harness.components" data-component-id="portal-harness.component_index" class="mx-auto max-w-7xl space-y-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex flex-wrap gap-2">
            <span class="badge badge-primary">Portal Harness</span>
            <span class="badge badge-success">Evalset 驱动</span>
          </div>
          <h1 class="mt-3 text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">组件可视化工作台</h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-slate-300">
            从 Portal UI evalset 和 fixture 自动生成，用于按路由、领域和状态检查当前组件表面。
          </p>
        </div>
        <RouterLink class="btn btn-secondary" to="/overview">返回工作台</RouterLink>
      </div>

      <section class="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div class="card p-4">
          <div class="text-xs text-gray-500 dark:text-slate-400">组件表面</div>
          <div class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{{ surfaces.length }}</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-gray-500 dark:text-slate-400">状态页面</div>
          <div class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{{ fixtureStates.length }}</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-gray-500 dark:text-slate-400">覆盖路由</div>
          <div class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{{ routeCount }}</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-gray-500 dark:text-slate-400">截图回归</div>
          <div class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{{ screenshotCount }}</div>
        </div>
      </section>

      <section data-component-id="portal-harness.component_state" class="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div class="min-w-0 space-y-5">
          <section class="card p-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">{{ isDetailRoute ? "同路由组件" : "按路由查看" }}</h2>
                <p class="panel-subtitle">{{ isDetailRoute ? "只展示当前路由下的组件状态。" : "每个路由下的 surface 和可浏览状态。" }}</p>
              </div>
              <span class="badge badge-primary">{{ visibleRouteGroups.length }} 组</span>
            </div>
            <div class="mt-4 space-y-4">
              <div v-for="[routeId, items] in visibleRouteGroups" :key="routeId" class="rounded-2xl border border-gray-100 p-3 dark:border-slate-700">
                <div class="text-sm font-semibold text-gray-950 dark:text-white">{{ routeId }}</div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <RouterLink
                    v-for="item in items"
                    :key="item.componentId"
                    class="badge"
                    :class="selected?.componentId === item.componentId ? 'badge-primary' : 'badge-success'"
                    :to="firstStatePath(item.componentId)"
                  >
                    {{ item.componentId }}
                  </RouterLink>
                </div>
              </div>
            </div>
          </section>

          <section v-if="!isDetailRoute" class="card p-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">按领域查看</h2>
                <p class="panel-subtitle">保持业务组件归属清晰。</p>
              </div>
              <span class="badge badge-success">{{ domainGroups.length }} 组</span>
            </div>
            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div v-for="[domain, items] in domainGroups" :key="domain" class="rounded-2xl border border-gray-100 p-3 dark:border-slate-700">
                <div class="text-sm font-semibold text-gray-950 dark:text-white">{{ domain }}</div>
                <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ items.length }} 个组件表面</div>
              </div>
            </div>
          </section>
        </div>

        <section class="card min-w-0 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="panel-title">{{ selected?.componentId || "选择组件状态" }}</h2>
              <p class="panel-subtitle">{{ selected?.question || "从左侧组件列表进入一个独立 fixture 状态页面。" }}</p>
            </div>
            <span v-if="selected" class="badge badge-primary">{{ selected.state }}</span>
          </div>

          <template v-if="selected">
            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="muted-kv">
                <span class="muted-kv-label">路由</span>
                <span class="muted-kv-value">{{ selected.routeId }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">领域</span>
                <span class="muted-kv-value">{{ selected.domain }}</span>
              </div>
              <div class="muted-kv sm:col-span-2">
                <span class="muted-kv-label">组件文件</span>
                <span class="muted-kv-value break-all text-right">{{ selected.owner }}</span>
              </div>
              <div class="muted-kv sm:col-span-2">
                <span class="muted-kv-label">Fixture</span>
                <span class="muted-kv-value break-all text-right">{{ selected.fixtureOwner }}</span>
              </div>
            </div>

            <div class="mt-5">
              <h3 class="text-sm font-semibold text-gray-950 dark:text-white">可切换状态</h3>
              <div class="mt-2 flex flex-wrap gap-2">
                <RouterLink
                  v-for="state in selected.states"
                  :key="state"
                  class="btn"
                  :class="state === selected.state ? 'btn-primary' : 'btn-secondary'"
                  :to="`${basePath}/${selected.componentId}/${state}`"
                >
                  {{ state }}
                </RouterLink>
              </div>
            </div>

            <div class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]">
              <div class="rounded-2xl border border-gray-100 p-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">渲染模式</div>
                <div class="mt-1 text-sm font-medium text-gray-950 dark:text-white">真实业务组件</div>
              </div>
              <div class="flex flex-wrap gap-2 rounded-2xl border border-gray-100 p-3 dark:border-slate-700" aria-label="视口">
                <button class="btn" :class="selectedViewport === 'desktop' ? 'btn-primary' : 'btn-secondary'" type="button" @click="selectedViewport = 'desktop'">桌面</button>
                <button class="btn" :class="selectedViewport === 'tablet' ? 'btn-primary' : 'btn-secondary'" type="button" @click="selectedViewport = 'tablet'">平板</button>
                <button class="btn" :class="selectedViewport === 'mobile' ? 'btn-primary' : 'btn-secondary'" type="button" @click="selectedViewport = 'mobile'">手机</button>
              </div>
              <div class="flex flex-wrap gap-2 rounded-2xl border border-gray-100 p-3 dark:border-slate-700" aria-label="主题">
                <button class="btn" :class="selectedTheme === 'light' ? 'btn-primary' : 'btn-secondary'" type="button" @click="selectedTheme = 'light'">亮色</button>
                <button class="btn" :class="selectedTheme === 'dark' ? 'btn-primary' : 'btn-secondary'" type="button" @click="selectedTheme = 'dark'">暗色</button>
              </div>
            </div>

            <section class="mt-5 min-w-0 rounded-2xl border border-gray-100 bg-slate-100 p-4 dark:border-slate-700 dark:bg-slate-950">
              <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 class="text-sm font-semibold text-gray-950 dark:text-white">组件预览</h3>
                  <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">直接渲染业务组件，fixture 数据只作为状态输入。</p>
                </div>
                <span class="badge badge-success">{{ selectedViewport }} · {{ selectedTheme }}</span>
              </div>
              <div
                data-component-id="portal-harness.component_preview"
                class="min-w-0 overflow-auto rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                :class="selectedTheme === 'dark' ? 'dark' : ''"
                :data-theme="selectedTheme"
              >
                <div class="min-w-0" :class="previewShellClass">
                  <PortalComponentFixtureRenderer :selected="selected" />
                </div>
              </div>
            </section>

            <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <section class="min-w-0 rounded-2xl border border-gray-100 p-4 dark:border-slate-700">
                <h3 class="text-sm font-semibold text-gray-950 dark:text-white">组件不变量</h3>
                <ul class="mt-3 space-y-2 text-sm text-gray-600 dark:text-slate-300">
                  <li v-for="invariant in selected.invariants" :key="invariant" class="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                    {{ invariant }}
                  </li>
                </ul>
              </section>
              <section class="min-w-0 rounded-2xl border border-gray-100 p-4 dark:border-slate-700">
                <h3 class="text-sm font-semibold text-gray-950 dark:text-white">Fixture 数据</h3>
                <pre class="mt-3 max-h-[360px] max-w-full overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{{ selectedPayload }}</pre>
              </section>
            </div>
          </template>

          <div v-else class="empty-state mt-4">该组件或状态不存在。</div>
        </section>
      </section>

      <section v-if="!isDetailRoute" class="card p-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="panel-title">按状态查看</h2>
            <p class="panel-subtitle">用于检查 loading、ready、empty、restricted、error 等组件状态覆盖。</p>
          </div>
          <span class="badge badge-warning">{{ stateGroups.length }} 组</span>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div v-for="[state, items] in stateGroups" :key="state" class="rounded-2xl border border-gray-100 p-3 dark:border-slate-700">
            <div class="text-sm font-semibold text-gray-950 dark:text-white">{{ state }}</div>
            <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ items.length }} 个 fixture 页面</div>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import {
  findWorkbenchFixtureState,
  groupWorkbenchStatesByState,
  groupWorkbenchSurfacesByDomain,
  groupWorkbenchSurfacesByRoute,
  portalComponentWorkbench,
  portalScreenshotRegression,
  portalWorkbenchFixtureStates,
  portalWorkbenchSurfaces,
} from "@/harness/portal-component-workbench";
import PortalComponentFixtureRenderer from "@/views/harness/PortalComponentFixtureRenderer.vue";

const route = useRoute();
const selectedViewport = ref<"desktop" | "tablet" | "mobile">("desktop");
const selectedTheme = ref<"light" | "dark">("light");
const basePath = portalComponentWorkbench.basePath;
const surfaces = portalWorkbenchSurfaces;
const fixtureStates = portalWorkbenchFixtureStates;
const routeGroups = computed(() => Object.entries(groupWorkbenchSurfacesByRoute()));
const domainGroups = computed(() => Object.entries(groupWorkbenchSurfacesByDomain()));
const stateGroups = computed(() => Object.entries(groupWorkbenchStatesByState()));
const routeCount = computed(() => routeGroups.value.length);
const screenshotCount = computed(() => portalScreenshotRegression.routes.length);
const isDetailRoute = computed(() => Boolean(route.params.componentId && route.params.state));
const selected = computed(() => {
  const componentId = String(route.params.componentId || "overview.hero");
  const state = String(route.params.state || "ready");
  return findWorkbenchFixtureState(componentId, state);
});
const visibleRouteGroups = computed(() => {
  if (!isDetailRoute.value || !selected.value) return routeGroups.value;
  return routeGroups.value.filter(([routeId]) => routeId === selected.value?.routeId);
});
const selectedPayload = computed(() => JSON.stringify(selected.value?.payload || null, null, 2));
const previewShellClass = computed(() => ({
  desktop: "max-w-full",
  tablet: "mx-auto max-w-[820px]",
  mobile: "mx-auto max-w-[390px]",
}[selectedViewport.value]));

function firstStatePath(componentId: string) {
  const first = fixtureStates.find((item) => item.componentId === componentId);
  return first?.statePath || basePath;
}
</script>
