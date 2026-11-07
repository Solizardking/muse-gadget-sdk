const instructions = 'You are Muse inside Pocket Wallet. Help explain wallet and market concepts. You cannot access balances or prices unless supplied in the conversation. Never invent live data, quotes, receipts, or claim to have traded. Trading always requires a fresh quote and wallet approval.';
const protocols = ['responses','chat/completions','messages'];
export function musePanel() {
  return `<section class="card wide muse-card" id="muse-panel"><div class="muse-heading"><picture class="muse-avatar"><source srcset="/brand/clawd-builder-320.webp" media="(min-resolution: 2dppx)"><img src="/brand/clawd-builder-160.webp" alt="Clawd, your Muse companion" width="72" height="72" loading="lazy"></picture><div><span class="step">MUSE INSIDE</span><h2>A little help from Muse.</h2><p>Ask a question or prepare a command with Muse Spark. Every trade still needs your review.</p></div></div><div class="fields muse-fields"><label>Muse model<select id="muse-model"></select></label><label>API format<select id="muse-protocol"><option value="responses">Responses · reasoning continuity</option><option value="chat/completions">Chat Completions</option><option value="messages">Messages · Anthropic format</option></select></label><label>Thinking depth<select id="muse-effort"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="xhigh">Extra high</option></select></label></div><p id="muse-privacy" class="hint"></p><form id="muse-form"><label>Your question<input id="muse-prompt" maxlength="4000" placeholder="Explain slippage before I review a swap" required></label><button id="muse-send" disabled>Ask Muse</button><button id="muse-count" type="button" class="secondary" disabled>Count input tokens</button><button id="muse-reset" type="button" class="secondary">New conversation</button></form><p id="muse-answer" role="status" aria-live="polite"></p><p id="muse-usage" class="hint"></p></section>`;
}
export function installMuse({ $, api, action, hasSession }) {
  let configured = false, turns = [], generation = 0;
  const selection = () => ({model:$('#muse-model').value,protocol:$('#muse-protocol').value});
  const reset = () => { turns = []; generation++; $('#muse-answer').textContent=''; $('#muse-usage').textContent=''; };
  function refresh() {
    const {model,protocol} = selection();
    $('#muse-send').disabled = !configured || !hasSession();
    $('#muse-count').disabled = !configured || !hasSession() || protocol === 'chat/completions';
    $('#muse-privacy').textContent = !configured ? 'Muse needs a server API key to connect.' : model.includes('contributor') ? 'Contributor tier permits Meta to train on your prompts and replies. Choose a Standard model for private conversations.' : 'Standard tier. Your prompts and replies are not used for Meta training.';
  }
  function payload() {
    const {model,protocol} = selection(), prompt = $('#muse-prompt').value.trim(), effort = $('#muse-effort').value;
    if (!prompt) throw Error('Enter a question first.');
    if (turns.length >= 12) throw Error('Start a new conversation to keep device history small.');
    if (protocol === 'responses') return {model,instructions,input:[...turns.flat(),{role:'user',content:prompt}],store:false,include:['reasoning.encrypted_content'],reasoning:{effort},max_output_tokens:4096};
    const messages = [...turns.flat(),{role:'user',content:prompt}];
    if (protocol === 'messages') return {model,system:instructions,messages,thinking:{type:'adaptive'},output_config:{effort},max_tokens:4096};
    return {model,messages:[{role:'developer',content:instructions},...messages],reasoning_effort:effort,max_completion_tokens:4096};
  }
  for (const field of ['muse-model','muse-protocol']) $('#'+field).onchange = () => {reset();refresh();};
  $('#muse-reset').onclick = reset;
  $('#muse-form').onsubmit = event => { event.preventDefault(); action(async () => {
    const version = generation, {protocol} = selection(), body = payload(), submittedPrompt = $('#muse-prompt').value.trim();
    $('#muse-answer').textContent='Muse is thinking…';
    try {
      const response = await api('meta/'+protocol,body);
      if (version !== generation) return;
      if (response.status === 'failed' || response.status === 'incomplete' || response.stop_reason === 'max_tokens' || response.choices?.[0]?.finish_reason === 'length') throw Error('Muse did not finish. Try a shorter question or lower thinking depth.');
      const blocks = protocol === 'responses' ? (response.output||[]).filter(i=>i.type==='message').flatMap(i=>i.content||[]) : protocol === 'messages' ? response.content||[] : [];
      const answer = protocol === 'chat/completions' ? response.choices?.[0]?.message?.content : blocks.filter(i=>['text','output_text'].includes(i.type)).map(i=>i.text).join('\n');
      const tools = protocol === 'responses' ? response.output?.some(i=>i.type==='function_call') : protocol === 'messages' ? response.content?.some(i=>i.type==='tool_use') : response.choices?.[0]?.message?.tool_calls?.length;
      if (tools) throw Error('Muse requested a tool. This conversation view does not execute tools.');
      if (!answer) throw Error('Muse returned no text. Please try again.');
      const user = {role:'user',content:submittedPrompt};
      turns.push(protocol === 'responses' ? [user,...response.output] : [user,{role:'assistant',content:protocol === 'messages' ? response.content : response.choices[0].message.content}]);
      $('#muse-answer').textContent=answer;
      const usage=response.usage||{}, input=usage.input_tokens??usage.prompt_tokens??0, output=usage.output_tokens??usage.completion_tokens??0, cached=usage.input_tokens_details?.cached_tokens??usage.prompt_tokens_details?.cached_tokens??usage.cache_read_input_tokens??0;
      $('#muse-usage').textContent=`Input: ${input} tokens · output: ${output} tokens · cached: ${cached} tokens`;
    } catch(error) { if(version === generation) $('#muse-answer').textContent=error.message; throw error; }
  }); };
  $('#muse-count').onclick = () => action(async () => {
    const version=generation,{protocol}=selection();
    const result=await api('meta/'+(protocol==='responses'?'responses/input_tokens':'messages/count_tokens'),payload());
    if(version===generation) $('#muse-usage').textContent=`Input context: ${result.input_tokens} tokens. No output generated.`;
  });
  return {
    selection, refresh, reset,
    configure(meta) {
      configured=Boolean(meta?.configured);
      $('#muse-model').replaceChildren();
      for (const model of meta?.voice_models||['muse-spark-1.3']) {
        const option=document.createElement('option');option.value=model;option.textContent=model.replace('muse-spark-','Muse Spark ').replace('-contributor',' · Contributor');$('#muse-model').append(option);
      }
      if(meta?.voice_models?.includes(meta.model)) $('#muse-model').value=meta.model;
      if(protocols.includes(meta?.protocol)) $('#muse-protocol').value=meta.protocol;
      refresh();
    },
  };
}
