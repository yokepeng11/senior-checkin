export type Lang = 'en' | 'zh';

const strings = {
  en: {
    // RoleSelect
    appTitle: 'Daily Check-In',
    orgName: 'Fei Yue Eldercare Services',
    iAmSenior: 'I am a Senior',
    seniorSubtitle: 'Tap to do my daily check-in',
    iAmCaregiver: 'I am a Caregiver',
    caregiverSubtitle: 'View check-in status & reports',
    version: 'v1.0.0 · Fei Yue Community Services',

    // SeniorSetup
    welcome: 'Welcome!',
    welcomeSub: "Let's set up your profile to get started.",
    yourDetails: 'Your details',
    yourName: 'Your name',
    namePlaceholder: 'e.g. Mary Tan',
    dailyCheckinTime: 'Daily check-in time',
    preferredCheckinTime: 'Preferred check-in time',
    caregiverNok: 'Caregiver / next of kin',
    caregiverName: 'Caregiver name',
    caregiverNamePlaceholder: 'e.g. Sarah Tan',
    contactNumber: 'Contact number',
    contactPlaceholder: 'e.g. +65 9123 4567',
    errName: 'Please enter your name.',
    errNokName: "Please enter your caregiver's name.",
    errNokPhone: "Please enter your caregiver's contact number.",
    errSave: 'Could not save. Please check your connection and try again.',
    settingUp: 'Setting up…',
    getStarted: 'Get Started',
    notSenior: '← Not a Senior? Change role',

    // SeniorHome — main screen
    goodMorning: 'Good morning,',
    tapToCheckin: 'Tap the button below to check in',
    buttonLabel: 'Good Morning',
    buttonSub: 'Tap to check in ✓',
    allDone: 'All done for today!',
    checkedInAt: 'Checked in at',
    seeTomorrow: 'See you tomorrow! 😊',
    notYet: 'Not yet checked in today',

    // SeniorHome — confirm screen
    checkinSuccess: 'Check-in Successful!',
    greatDay: 'Have a great day!',

    // SeniorHome — settings screen
    settings: 'Settings',
    yourDetailsSetting: 'Your details',
    dailyReminder: 'Daily reminder',
    notifications: 'Notifications',
    notifOn: 'Notifications are on',
    notifOnSub: "You'll be reminded at your check-in time every day.",
    turningOff: 'Turning off…',
    turnOff: '🔕 Turn Off Notifications',
    notifBlocked: '🔕 Notifications are blocked',
    notifBlockedSub: "Go to your phone's Settings → \"Good Morning\" → Notifications and turn them on, then come back here.",
    notifUnsupported: 'Your device or browser does not support notifications. Make sure the app is installed from the Home Screen.',
    notifUnknownTitle: 'Get a daily reminder at your check-in time',
    turnOn: '🔔 Turn On Notifications',
    alertBanner: "If you haven't checked in by 12:00 PM, we'll text your caregiver automatically.",
    saveSettings: 'Save Settings',
    changeRole: 'Change role / Switch device',

    // Language section
    language: 'Language',
    langEn: 'English',
    langZh: '中文',
  },
  zh: {
    // RoleSelect
    appTitle: '每日报到',
    orgName: '惠民乐龄照护服务',
    iAmSenior: '我是乐龄人士',
    seniorSubtitle: '点击完成每日报到',
    iAmCaregiver: '我是护理人员',
    caregiverSubtitle: '查看报到状况及报告',
    version: 'v1.0.0 · 惠民社会服务',

    // SeniorSetup
    welcome: '欢迎！',
    welcomeSub: '让我们设置您的资料以开始使用。',
    yourDetails: '您的资料',
    yourName: '您的姓名',
    namePlaceholder: '例如：陈美丽',
    dailyCheckinTime: '每日报到时间',
    preferredCheckinTime: '首选报到时间',
    caregiverNok: '护理人员 / 紧急联络人',
    caregiverName: '护理人员姓名',
    caregiverNamePlaceholder: '例如：陈小慧',
    contactNumber: '联络号码',
    contactPlaceholder: '例如：+65 9123 4567',
    errName: '请输入您的姓名。',
    errNokName: '请输入护理人员的姓名。',
    errNokPhone: '请输入护理人员的联络号码。',
    errSave: '无法保存，请检查网络连接后重试。',
    settingUp: '设置中……',
    getStarted: '开始使用',
    notSenior: '← 不是乐龄人士？更改身份',

    // SeniorHome — main screen
    goodMorning: '早上好，',
    tapToCheckin: '点击下方按钮进行报到',
    buttonLabel: '早安',
    buttonSub: '点击报到 ✓',
    allDone: '今天已完成！',
    checkedInAt: '报到时间：',
    seeTomorrow: '明天见！😊',
    notYet: '今天尚未报到',

    // SeniorHome — confirm screen
    checkinSuccess: '报到成功！',
    greatDay: '祝您有美好的一天！',

    // SeniorHome — settings screen
    settings: '设置',
    yourDetailsSetting: '您的资料',
    dailyReminder: '每日提醒',
    notifications: '通知',
    notifOn: '通知已开启',
    notifOnSub: '每天在您的报到时间发送提醒。',
    turningOff: '关闭中……',
    turnOff: '🔕 关闭通知',
    notifBlocked: '🔕 通知已被阻止',
    notifBlockedSub: '请前往手机的设置 → "早安" → 通知，打开通知后回到此处。',
    notifUnsupported: '您的设备或浏览器不支持通知。请确保已从主屏幕安装应用程序。',
    notifUnknownTitle: '在您的报到时间获得每日提醒',
    turnOn: '🔔 开启通知',
    alertBanner: '如果您在中午12点前未报到，我们将自动发短信通知您的护理人员。',
    saveSettings: '保存设置',
    changeRole: '更改身份 / 切换设备',

    // Language section
    language: '语言',
    langEn: 'English',
    langZh: '中文',
  },
};

export function t(lang: Lang, key: keyof typeof strings.en): string {
  return strings[lang][key] ?? strings.en[key];
}

export function getLang(): Lang {
  const saved = localStorage.getItem('sc_lang');
  return saved === 'zh' ? 'zh' : 'en';
}

export function setLang(lang: Lang): void {
  localStorage.setItem('sc_lang', lang);
}
