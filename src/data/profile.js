/**
 * ✏️  EDIT THIS FILE — it is the only place you need to change to make the portfolio yours.
 * Every section of the page, every signpost on the village road and every page of the
 * Project Book is generated from it.
 */
export const profile = {
  name: 'Akash Pathak',
  role: 'Full-Stack Engineer',
  tagline: 'React · Next.js · Java Spring Boot · Node.js. I build products end to end, from the UI to the database to the deploy pipeline.',
  location: 'Jaipur, India · open to relocate to Bengaluru',
  email: 'aakapa95@gmail.com',
  phone: '+91 93528 78869',
  links: [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/akash9587' },
    { label: 'GitHub', url: 'https://github.com/akashpathak9587' },
  ],
  // Served from public/resume.pdf (set to null to hide the résumé buttons).
  resumeUrl: '/resume.pdf',

  about: [
    'Full-stack engineer with about 2 years of experience building web and mobile products end to end: React and Next.js front ends, Java 21 / Spring Boot and Node.js services, PostgreSQL, MongoDB and Redis data layers, and Docker, Kubernetes and Jenkins deployments.',
    'I lead a frontend team while also owning backend services, so I am comfortable taking a feature from design document to UI, API, database and production. Strong in data structures, OOP and system design, quick to pick up new languages, and keen on AI-assisted development.',
  ],
  highlights: [
    { value: '2+', label: 'Years building end-to-end products' },
    { value: '7', label: 'Products in a multi-app SaaS suite' },
    { value: 'Lead', label: 'Frontend team + backend ownership' },
  ],

  skills: [
    { group: 'Frontend', items: ['React', 'Next.js', 'Redux', 'Material UI', 'TypeScript', 'JavaScript'] },
    { group: 'Backend', items: ['Java 21', 'Spring Boot', 'Node.js', 'REST APIs', 'Microservices', 'OpenAPI'] },
    { group: 'Data & Messaging', items: ['PostgreSQL', 'MongoDB', 'Redis', 'Kafka', 'SQL / PL-SQL', 'Query Optimization'] },
    { group: 'DevOps', items: ['Docker', 'Kubernetes', 'Jenkins', 'Ansible', 'CI/CD', 'Grafana', 'Linux'] },
    { group: 'Cloud & Tools', items: ['AWS S3', 'Lambda', 'EC2', 'CloudFront', 'Git', 'Postman'] },
    { group: 'Fundamentals', items: ['Data Structures', 'Algorithms', 'OOP / SOLID', 'Design Patterns', 'System Design', 'DB Design'] },
  ],

  experience: [
    {
      company: 'Synoriq R&D Pvt. Ltd., Jaipur',
      role: 'Associate Software Engineer II (Frontend Lead)',
      period: 'Sep 2024 — Present',
      points: [
        'Lead the frontend team across a suite of seven web and mobile products (LMS, Collection App, Customer App, API Box, Insights, Admin), while owning backend services end to end.',
        'Built REST APIs and microservices in Java 21 / Spring Boot, documented with OpenAPI / Swagger.',
        'Designed Kafka event-driven notification services and integrated six third-party payment gateways with real-time status updates.',
        'Kept services fast under heavy concurrent load with Redis caching and PostgreSQL query optimization.',
        'Built real-time features: live location tracking for field agents, live user-activity tracking, and a CloudFront CDN + Lambda layer for document delivery.',
        'Shipped with Docker, Kubernetes (HPA autoscaling), Jenkins and Ansible, with deployment and test reports automated to email and Google Chat.',
        'Wrote system design documents before new features and ran Git-based code reviews.',
      ],
    },
    {
      company: 'Nitte Meenakshi Institute of Technology, Bangalore',
      role: 'Master of Computer Applications',
      period: '2022 — 2024',
      points: [
        'CGPA 8.15.',
        'Published a research paper on a DevOps project automating a CI/CD pipeline.',
      ],
    },
  ],

  /**
   * Projects appear on the ride's "Projects" stop (name, description, tech) and get a
   * two-page chapter each in the Project Book (all fields).
   */
  projects: [
    {
      name: 'API Box',
      icon: '🔌',
      category: 'API Platform',
      role: 'Backend design and implementation',
      description: 'A public API layer over the product suite, so third-party front ends can work with loan, customer and reporting data.',
      points: [
        'REST APIs for loan, customer and reporting data.',
        'Authentication, access control and per-client usage tracking.',
        'Interactive documentation with Swagger UI / OpenAPI.',
        'PostgreSQL data layer shared with the rest of the suite.',
      ],
      tech: ['Java 21', 'Spring Boot', 'Swagger UI', 'PostgreSQL'],
      link: '',
      repo: '',
    },
    {
      name: 'Loan Management System',
      icon: '📊',
      category: 'SaaS Platform · Full-stack',
      role: 'Full-stack: React front end and Spring Boot services',
      description: 'The core SaaS product of a lending suite: loan lifecycle management, payments and receipts, rule-based validation, bulk jobs and dynamic reporting.',
      points: [
        'Full loan lifecycle: EMI payments, receipts and restructuring flows.',
        'A configurable validation engine for business and compliance rules.',
        'Bulk processing for large batch operations.',
        'Dynamic reports generated with SQL / PL-SQL.',
        'React front end on top of Spring Boot services.',
      ],
      tech: ['Java 21', 'Spring Boot', 'React', 'PostgreSQL', 'PL/SQL'],
      link: '',
      repo: '',
    },
    {
      name: 'Collection App',
      icon: '📍',
      category: 'Web + Mobile · Real-time',
      role: 'Full-stack: React UI and real-time backend',
      description: 'A field-operations app for agents on the move, with secure transactions and a live link back to the main platform.',
      points: [
        'Secure transaction capture and customer verification.',
        'Live location tracking for field agents.',
        'Real-time sync with the core platform.',
        'Works on both web and mobile.',
      ],
      tech: ['React', 'Java 21', 'Spring Boot', 'PostgreSQL'],
      link: '',
      repo: '',
    },
    {
      name: 'DevOps CI/CD Pipeline',
      icon: '⚙️',
      category: 'DevOps · Published research',
      role: 'Design, implementation and research paper',
      description: 'An automated build, test and deployment pipeline, written up and published as a research paper.',
      points: [
        'Automated build, test and deployment on every commit.',
        'Containerised builds with Docker on Linux.',
        'Pipeline-as-code in Jenkins, driven by Git.',
        'Findings published as a research paper.',
      ],
      tech: ['Jenkins', 'Docker', 'Linux', 'Git'],
      link: '',
      repo: '',
    },
    {
      name: 'Village Journey Portfolio',
      icon: '🚲',
      category: '3D Web · Full-stack + DevOps',
      role: 'Design, front end and delivery pipeline',
      description: 'This site: a scroll-driven 3D bicycle ride and a page-turning Project Book, containerised with Docker, built by Jenkins and deployed with Ansible.',
      points: [
        'Scroll-driven 3D world built with React, Vite and Three.js.',
        'This page-turning Project Book, animated with CSS 3D transforms.',
        'Multi-stage Docker image served by nginx.',
        'Jenkins pipeline that builds, smoke-tests, pushes and deploys.',
        'Ansible playbook that provisions the server and runs the container.',
      ],
      tech: ['React', 'Three.js', 'Docker', 'Jenkins', 'Ansible'],
      link: '',
      repo: 'https://github.com/akashpathak9587/village-portfolio',
    },
  ],

  contactNote: "Thanks for riding along! I'm open to full-stack engineering roles. Let's talk.",
};

/** The stops on the ride. `sign` is the text painted on each roadside signpost. */
export const milestones = [
  { id: 'home', label: 'Start', sign: 'Welcome!' },
  { id: 'about', label: 'About', sign: 'About Me' },
  { id: 'skills', label: 'Skills', sign: 'Skills' },
  { id: 'experience', label: 'Experience', sign: 'Experience' },
  { id: 'projects', label: 'Projects', sign: 'Projects' },
  { id: 'contact', label: 'Contact', sign: 'Say Hello' },
];
