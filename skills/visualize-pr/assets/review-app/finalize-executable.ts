if (process.platform === 'darwin') {
  const result = Bun.spawnSync(
    ['codesign', '--force', '--sign', '-', './pr-review-map'],
    {
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );

  if (!result.success) {
    process.exit(result.exitCode);
  }
}
