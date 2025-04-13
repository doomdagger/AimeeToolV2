// 标签显示配置
const tagConfig = {
  // 标签的阈值配置
  thresholds: {
    exposure: 1000,     // 高曝光阈值
    clicks: 500,        // 高点击阈值
    clickRate: 0.15,    // 点击率优秀阈值
    convRate: 0.1,      // 转化率优秀阈值
    gpm: 1000,          // 高GPM阈值
    sales: 50,          // 高销量阈值
    transactionAmount: 5000,  // 高成交额阈值

    // 最低要求
    minExposure: 100,   // 显示点击率标签的最低曝光量
    minClicks: 20       // 显示转化率标签的最低点击量
  },

  // 标签的显示规则配置
  tags: {
    '高曝光': {
      type: 'exposure',
      field: 'product_show_ucnt',
      tooltipTemplate: value => `曝光人数: ${value}`,
      getValue: product => product.product_show_ucnt.value,
      shouldShow: (product, thresholds) => {
        const value = product.product_show_ucnt.value;
        return value >= thresholds.exposure;
      }
    },
    '高点击': {
      type: 'click',
      field: 'product_click_ucnt',
      tooltipTemplate: value => `点击人数: ${value}`,
      getValue: product => product.product_click_ucnt.value,
      shouldShow: (product, thresholds) => {
        const value = product.product_click_ucnt.value;
        return value >= thresholds.clicks;
      }
    },
    '点击率优': {
      type: 'conversion',
      field: 'product_show_click_ucnt_ratio',
      tooltipTemplate: value => `点击率: ${(value * 100).toFixed(2)}%`,
      getValue: product => product.product_show_click_ucnt_ratio.value,
      shouldShow: (product, thresholds) => {
        const exposure = product.product_show_ucnt.value;
        const ratio = product.product_show_click_ucnt_ratio.value;
        return exposure >= thresholds.minExposure && ratio >= thresholds.clickRate;
      }
    },
    '转化率优': {
      type: 'conversion',
      field: 'product_click_pay_ucnt_ratio',
      tooltipTemplate: value => `转化率: ${(value * 100).toFixed(2)}%`,
      getValue: product => product.product_click_pay_ucnt_ratio.value,
      shouldShow: (product, thresholds) => {
        const clicks = product.product_click_ucnt.value;
        const ratio = product.product_click_pay_ucnt_ratio.value;
        return clicks >= thresholds.minClicks && ratio >= thresholds.convRate;
      }
    },
    '高GPM': {
      type: 'gpm',
      field: 'gpm',
      tooltipTemplate: value => `GPM: ¥${(value / 100).toFixed(2)}`,
      getValue: product => product.gpm?.value || 0,
      shouldShow: (product, thresholds) => {
        const gpm = product.gpm?.value || 0;
        return gpm >= thresholds.gpm;
      }
    },
    '高成交额': {
      type: 'transaction',
      field: 'calculatedMetrics.transactionAmount',
      tooltipTemplate: value => `成交额: ¥${value.toFixed(2)}`,
      getValue: product => product.calculatedMetrics.transactionAmount,
      shouldShow: (product, thresholds) => {
        const amount = product.calculatedMetrics.transactionAmount;
        return amount >= thresholds.transactionAmount;
      }
    },
    '高销量': {
      type: 'sales',
      field: 'pay_combo_cnt',
      tooltipTemplate: value => `成交件数: ${value}`,
      getValue: product => product.pay_combo_cnt?.value || 0,
      shouldShow: (product, thresholds) => {
        const sales = product.pay_combo_cnt?.value || 0;
        return sales >= thresholds.sales;
      }
    }
  },

  // 根据标签名获取配置
  getTagConfig(tagName) {
    return this.tags[tagName];
  },

  // 检查标签是否应该显示
  shouldShowTag(tagName, product) {
    const config = this.tags[tagName];
    if (!config) return false;
    return config.shouldShow(product, this.thresholds);
  },

  // 生成标签HTML
  generateTagHtml(tagName, product) {
    const config = this.tags[tagName];
    if (!config || !this.shouldShowTag(tagName, product)) return '';

    const value = config.getValue(product);
    const tooltip = config.tooltipTemplate(value);
    
    return `<span class="tag" data-performance="${config.type}" data-tooltip="${tooltip}">${tagName}</span>`;
  }
};

// 导出配置
export default tagConfig;
