function listFiles() {
  const files = Drive.Files.list({
    orderBy: 'modifiedDate desc',
    maxResults: 10
  });

  files.items.forEach(f => console.log(f.title));
}
