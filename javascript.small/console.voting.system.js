// Simplified poll implementation
const poll = new Map();

function addOption(option) {
  if (typeof option !== "string" || option.trim() === "") {
    return "Option cannot be empty.";
  }
  const key = option.trim();
  if (!poll.has(key)) {
    poll.set(key, new Set());
    return `Option "${key}" added to the poll.`;
  }
  return `Option "${key}" already exists.`;
}

function vote(option, voterId) {
  if (typeof option !== "string" || option.trim() === "") {
    return "Option cannot be empty.";
  }
  if (typeof voterId !== "string" || voterId.trim() === "") {
    return "Voter ID cannot be empty.";
  }
  const key = option.trim();
  const voter = voterId.trim();
  if (!poll.has(key)) {
    return `Option "${key}" does not exist.`;
  }
  const voters = poll.get(key);
  if (voters.has(voter)) {
    return `Voter ${voter} has already voted for "${key}".`;
  }
  voters.add(voter);
  return `Voter ${voter} voted for "${key}".`;
}

function displayResults() {
  const lines = ["Poll Results:"];
  for (const [option, voters] of poll.entries()) {
    lines.push(`${option}: ${voters.size} votes`);
  }
  return lines.join("\n");
}

addOption("Turkey");
addOption("Morocco");
addOption("Spain");

vote("Turkey", "travelerA");
vote("Turkey", "travelerB");
vote("Morocco", "travelerC");

console.log(displayResults());
