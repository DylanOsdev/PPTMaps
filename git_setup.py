import subprocess
import os

def run_cmd(cmd, cwd=None):
    print(f"Running: {' '.join(cmd)} in {cwd or '.'}")
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    print("STDOUT:", result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    return result.returncode

# Initialize git repository
run_cmd(["git", "init"])

# Add files
run_cmd(["git", "add", "."])

# Check status
run_cmd(["git", "status"])

# Commit
run_cmd(["git", "commit", "-m", "Initial commit: MoviMed backend structure"])

# Change branch to main
run_cmd(["git", "branch", "-M", "main"])

# Add remote
run_cmd(["git", "remote", "add", "origin", "https://github.com/DylanOsdev/PPTMaps.git"])

# Check remotes
run_cmd(["git", "remote", "-v"])

# Push to remote (we will try, but it might fail if authentication is needed)
print("Attempting to push to remote...")
push_result = run_cmd(["git", "push", "-u", "origin", "main"])

if push_result != 0:
    print("Push failed. This is likely due to missing authentication (Personal Access Token).")
