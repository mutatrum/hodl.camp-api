function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function pad(string) {
  return string.toString().padStart(2, '0');
}

module.exports = { formatDate };
