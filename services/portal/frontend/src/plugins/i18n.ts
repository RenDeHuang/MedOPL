import { createI18n } from "vue-i18n";

export default createI18n({
  legacy: false,
  locale: "zh-CN",
  fallbackLocale: "zh-CN",
  messages: {
    "zh-CN": {
      app: {
        title: "Portal Console",
        subtitle: "任务、成本、健康、运营动作统一控制台"
      }
    }
  }
});
