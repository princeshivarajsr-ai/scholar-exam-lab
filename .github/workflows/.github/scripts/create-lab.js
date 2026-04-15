const github = require('@actions/github');
const core = require('@actions/core');

async function run() {
  const token = process.env.GITHUB_TOKEN;
  const issueNumber = process.env.ISSUE_NUMBER;
  const studentLogin = process.env.COMMENT_USER;

  const octokit = github.getOctokit(token);
  const context = github.context;
  const { owner, repo } = context.repo;

  console.log(`🚀 Starting Lab Session for User: ${studentLogin}...`);

  try {
    // 1. Get the Issue Content (The Exam Question)
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    // 2. Create a unique branch for this student session
    const branchName = `lab-session-${issueNumber}-${studentLogin}`;
    
    // Get the SHA of the default branch to branch off
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/main`,
    });

    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: refData.object.sha,
    });

    // 3. Create a "Notebook" file for them to write in
    const filePath = `submissions/session-${issueNumber}-${studentLogin}.md`;
    const fileContent = `# 🎓 Lab Session: ${issue.title}

**Student:** @${studentLogin}
**Reference:** Issue #${issueNumber}

---
## 📝 Your Answer Workspace
*Start typing your answer below. The AI Examiner is watching...*

`;

    const contentBase64 = Buffer.from(fileContent).toString('base64');

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Start lab session for ${studentLogin}`,
      content: contentBase64,
      branch: branchName,
    });

    // 4. Open a Pull Request (The "Lab")
    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: `🧪 Lab Session: Answer to "${issue.title}"`,
      head: branchName,
      base: 'main',
      body: `### ✨ Your Personal Lab is Open!

@${studentLogin}, this is your private workspace.
1. Open the file \`${filePath}\`.
2. Write your answer or code.
3. **Commit changes.**
4. The AI Examiner will immediately review your work and guide you!

**Original Question:**
> ${issue.body}
`,
      draft: false
    });

    // 5. React to the command
    await octokit.rest.reactions.createForIssueComment({
      owner,
      repo,
      comment_id: context.payload.comment.id,
      content: 'rocket'
    });

    // 6. Post link in issue
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `🚀 **Lab Session Created!** 
      
Click here to enter your workspace: [Pull Request #${pr.number}](${pr.html_url})`
    });

    console.log("✅ Lab created successfully.");

  } catch (error) {
    console.error(error);
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `⚠️ Error starting lab: ${error.message}`
    });
  }
}

run();
