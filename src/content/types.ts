export interface LabeledValue {
  label: string
  value: string
}

export interface Job {
  years: string
  company: string
  role: string
  description: string
}

export interface EducationEntry {
  term: string
  description: string
}

export interface SpecGroup {
  label: string
  text: string
}

export interface Content {
  meta: {
    title: string
  }
  nav: {
    about: string
    specs: string
    work: string
    contact: string
  }
  header: {
    navGroupLabel: string
    langGroupLabel: string
    variantGroupLabel: string
    variantNoche: string
    variantDia: string
  }
  hero: {
    eyebrow: string
    name: string
    ledeBefore: string
    ledeEmphasis: string
    ledeAfter: string
    indicator: string
  }
  about: {
    kicker: string
    title: string
    paragraphs: string[]
    stats: LabeledValue[]
  }
  specs: {
    kicker: string
    titleLine1: string
    titleLine2: string
    modelLine1: string
    modelLine2: string
    groups: SpecGroup[]
    tail: string
  }
  work: {
    kicker: string
    title: string
    jobs: Job[]
    educationKicker: string
    education: EducationEntry[]
  }
  contact: {
    titleLine1: string
    titleLine2: string
    emailLabel: string
    email: string
    copyLabel: string
    copiedLabel: string
    locationLabel: string
    locationValue: string
    cvLabel: string
    cvButtonLabel: string
    cvGroupLabel: string
    cvOptionEs: string
    cvOptionEn: string
  }
  speech: {
    lines: string[]
    pokes: string[]
  }
  footer: {
    copyright: string
  }
}
