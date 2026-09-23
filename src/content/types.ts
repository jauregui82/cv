export interface LabeledValue {
  label: string
  value: string
}

export interface Job {
  company: string
  meta: string
  description: string
}

export interface Content {
  meta: {
    title: string
  }
  nav: {
    about: string
    work: string
    contact: string
  }
  hero: {
    name: string
    role: string
    tagline: string
  }
  about: {
    title: string
    paragraphs: string[]
  }
  experience: {
    title: string
    educationTitle: string
    education: LabeledValue[]
    workTitle: string
    jobs: Job[]
    previousExperience: LabeledValue
    skillsTitle: string
    skills: LabeledValue[]
  }
  contact: {
    title: string
    emailLabel: string
    whatsappLabel: string
    locationLabel: string
    email: string
    whatsappLink: string
    whatsappDisplay: string
  }
  footer: {
    rights: string
  }
}
