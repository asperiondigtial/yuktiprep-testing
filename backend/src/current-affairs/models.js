export class Source {
  constructor({
    key,
    name,
    organisation,
    region,
    subject,
    url,
    allowed_domains,
    mode,
    priority,
    enabled = true,
  }) {
    this.key = key;
    this.name = name;
    this.organisation = organisation;
    this.region = region;
    this.subject = subject;
    this.url = url;
    this.allowed_domains = allowed_domains;
    this.mode = mode;
    this.priority = priority;
    this.enabled = enabled;
  }
}

export class RawItem {
  constructor({ title, summary, url, published_at }) {
    this.title = title;
    this.summary = summary;
    this.url = url;
    this.published_at = published_at;
  }
}

export class ScoredItem {
  constructor({
    source_key,
    title,
    summary,
    url,
    published_at,
    theme,
    score,
    source_confidence,
    exams = [],
    exam_groups = [],
    prelims = 1,
    mains = 1,
    pcs = 1,
    ssc = 0,
    banking = 0,
    static_link,
  }) {
    this.source_key = source_key;
    this.title = title;
    this.summary = summary;
    this.url = url;
    this.published_at = published_at;
    this.theme = theme;
    this.score = score;
    this.source_confidence = source_confidence;
    this.exams = Array.isArray(exams) ? exams : [];
    this.exam_groups = Array.isArray(exam_groups) ? exam_groups : [];
    this.prelims = prelims;
    this.mains = mains;
    this.pcs = pcs;
    this.ssc = ssc;
    this.banking = banking;
    this.static_link = static_link;
  }
}
