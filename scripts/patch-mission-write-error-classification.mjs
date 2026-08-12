import { readFile, writeFile } from 'node:fs/promises';

const appPath = new URL('../mission-001-app.js', import.meta.url);
const testPath = new URL('../tests/static/mission-001-state-recovery-browser.test.mjs', import.meta.url);
let app = await readFile(appPath, 'utf8');
let test = await readFile(testPath, 'utf8');

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`patch_anchor_missing:${label}`);
  return source.replace(from, to);
}

app = replaceOnce(app,
`  function stateFailure() {
`,
`  function isStateGuardError(error) {
    const code = String(error?.message || error || '');
    return code === 'mission_state_invalid' || code === 'mission_transition_invalid';
  }

  function missionWriteFailure(error) {
    if (!isStateGuardError(error)) {
      storageFailure(error);
      return 'storage';
    }
    let node = $('transitionFailure');
    if (!node) {
      node = document.createElement('div');
      node.id = 'transitionFailure';
      node.className = 'notice';
      node.setAttribute('role', 'alert');
      document.querySelector('main')?.prepend(node);
    }
    node.textContent = 'That action did not match the current mission stage and was rejected. Your last valid mission state was kept.';
    return 'state';
  }

  function stateFailure() {
`, 'classification_helper');

app = replaceOnce(app,
`      storageFailure(error);
      return;
    }
    hidden('commit', false);`,
`      missionWriteFailure(error);
      return;
    }
    hidden('commit', false);`, 'class_select_catch');

app = replaceOnce(app,
`    catch (error) { storageFailure(error); $('commitError').textContent = 'Could not save this mission privately. Nothing was committed.'; return; }`,
`    catch (error) {
      const failure = missionWriteFailure(error);
      $('commitError').textContent = failure === 'state'
        ? 'That action is not available from the current mission stage. Your last valid state was kept.'
        : 'Could not save this mission privately. Nothing was committed.';
      return;
    }`, 'commit_catch');

app = replaceOnce(app,
`    catch (error) { storageFailure(error); return; }
    signal('mission_exit_prompt_seen', state.class);`,
`    catch (error) { missionWriteFailure(error); return; }
    signal('mission_exit_prompt_seen', state.class);`, 'leave_catch');

app = replaceOnce(app,
`    catch (error) { storageFailure(error); return; }
    signal(eventMap[outcome], state.class);`,
`    catch (error) { missionWriteFailure(error); return; }
    signal(eventMap[outcome], state.class);`, 'outcome_catch');

app = replaceOnce(app,
`    catch (error) { storageFailure(error); $('successError').textContent = 'Could not save this debrief privately.'; return; }`,
`    catch (error) {
      const failure = missionWriteFailure(error);
      $('successError').textContent = failure === 'state'
        ? 'That debrief is not available from the current mission stage. Your last valid state was kept.'
        : 'Could not save this debrief privately.';
      return;
    }`, 'success_catch');

app = replaceOnce(app,
`    catch (error) { storageFailure(error); $('failedError').textContent = 'Could not save this failure debrief privately.'; return; }`,
`    catch (error) {
      const failure = missionWriteFailure(error);
      $('failedError').textContent = failure === 'state'
        ? 'That debrief is not available from the current mission stage. Your last valid state was kept.'
        : 'Could not save this failure debrief privately.';
      return;
    }`, 'failed_catch');

app = replaceOnce(app,
`    catch (error) { storageFailure(error); $('notStartedError').textContent = 'Could not save this start debrief privately.'; return; }`,
`    catch (error) {
      const failure = missionWriteFailure(error);
      $('notStartedError').textContent = failure === 'state'
        ? 'That debrief is not available from the current mission stage. Your last valid state was kept.'
        : 'Could not save this start debrief privately.';
      return;
    }`, 'not_started_catch');

app = replaceOnce(app,
`        catch (error) { storageFailure(error); }
      }
      summary('returnSummary');`,
`        catch (error) { missionWriteFailure(error); }
      }
      summary('returnSummary');`, 'return_tracking_catch');

test = replaceOnce(test,
`  const page = await browser.newPage();

  await page.goto(url);
  await createCommittedMission(page);
  const before = await page.evaluate(async key => window.ClovePrivateStore.get(key, null), STORAGE_KEY);`,
`  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(url);
  await createCommittedMission(page);
  const before = await page.evaluate(async key => window.ClovePrivateStore.get(key, null), STORAGE_KEY);`, 'hidden_transition_console_capture');

test = replaceOnce(test,
`  assert.equal(await page.locator('#debriefSuccess').isVisible(), false);
  assert.equal(signals.some(s => s.event === 'mission_done'), false);
});`,
`  assert.equal(await page.locator('#debriefSuccess').isVisible(), false);
  assert.equal(signals.some(s => s.event === 'mission_done'), false);
  assert.equal(await page.locator('#storageFailure').count(), 0, 'state guard must not masquerade as a storage failure');
  assert.match(await page.locator('#transitionFailure').innerText(), /rejected|last valid mission state/i);
  assert.deepEqual(consoleErrors, [], 'expected state-guard rejection to avoid console.error');
});`, 'hidden_transition_assertions');

await writeFile(appPath, app, 'utf8');
await writeFile(testPath, test, 'utf8');
console.log('patched Mission write-error classification and regression test');
