export interface SolutionOption {
  label: string;
  correct: boolean;
  explanation: string;
}

export interface Stage5Content {
  options: SolutionOption[];
}
