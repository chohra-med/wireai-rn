# EU AI Act: acceptable use and our position

**Position as of 2026-08-06, against Regulation (EU) 2024/1689 as amended by Regulation (EU) 2026/1744.**

This is our own reading of where `wireai-rn` sits inside the regulation, written down so you can see the reasoning and disagree with it where your build is different from ours.

It is not legal advice. Nobody has audited this SDK against the regulation, and a review by a qualified lawyer is pending. Where that review says we read something wrong, this file gets corrected and re-dated.

---

## Who is who

`wireai-rn` is a rendering library that runs no model and hosts no service of its own. It takes a JSON response from an endpoint you configure (Ollama, LM Studio, OpenAI, your own webhook, or an A2A agent), validates it against the Zod schemas you registered, and renders React Native components.

So in most configurations, the app that installs this SDK is the one putting an AI system into service. You pick the model, you write the prompt, you decide the flow, you decide what happens with the answers. You are the **deployer** of the surface you ship, and often the provider of the system you assembled out of it.

Wire is the provider of a limited-risk component inside that: the renderer and the schema layer.

---

## Not for high-risk use

**This system is not intended to be put into service as, or changed into, a high-risk AI system.**

Do not build Wire-powered surfaces into an Annex III high-risk area:

1. Biometrics
2. Critical infrastructure
3. Education and vocational training
4. Employment, workers management and access to self-employment
5. Access to essential private and public services and benefits
6. Law enforcement
7. Migration, asylum and border control
8. Administration of justice and democratic processes

Obligations for Annex III systems apply from 2 December 2027, which is not a countdown to when this becomes usable there. It is not what this SDK is built for, at any date.

Two prohibitions in Article 5(1) have been live since 2 February 2025 and were left untouched by the Omnibus. Do not use these surfaces for subliminal, manipulative or deceptive techniques that materially distort behaviour, and do not use them to exploit vulnerabilities due to age, disability, or a specific social or economic situation.

That second one deserves saying out loud, because a UI a model generates per user is an easy place to cross it without meaning to. A flow that adapts because it learned what a user responds to is one short step from a flow that adapts because it learned what a user cannot resist. Optimise for the user finishing something they came to do.

---

## Article 50(1): telling people they are talking to an AI

Article 50(1) applies since 2 August 2026. There is no legacy grace period for it.

It requires that AI systems intended to interact directly with natural persons are designed so those persons are informed they are interacting with an AI system, unless that is obvious from the point of view of a reasonably well-informed, observant and circumspect natural person.

Our reading of the generated-UI case: generated UI is not a conversational agent. Cards, buttons, pickers and form fields do not present themselves as a person, and someone tapping through a selection card is not being led to believe there is a human on the other end. A form is obvious.

Where that reading stops matters more here than it does in most integrations. This SDK ships `MessageBubble`, and the boilerplate app in this repo is a `ChatScreen`. A chat-shaped surface, or any surface that answers a user in free prose the way a person would, is the case Article 50(1) was written for. If you build that, **your app owns the disclosure**, not the SDK.

We cannot place it for you. We do not control your screen, your copy, or your first-run experience. Put it where the user meets the surface, not buried in a settings page or a policy document nobody opens.

The honest edge in between: `TextInputCard` takes free text, and the copy on the next card is generated from what the user typed. We read that as a form that adapts rather than a conversation, because the system does not answer as an interlocutor and the interaction stays inside the component vocabulary you registered. If that reading does not hold for the flow you built, disclose. Nothing in the SDK stops you.

---

## Article 50(2): marking generated content

Article 50(2) covers providers of AI systems that generate synthetic audio, image, video or text, and requires the outputs to be marked in a machine-readable format as artificially generated or manipulated. Its legacy grace period runs to 2 December 2026, and only for providers of those generators.

Our reading has two parts.

The first is that Wire does not provide the generative model. The text that reaches a user was produced by a model you chose, running on an endpoint you configured. Provider-level marking of a model's output sits upstream, with the provider of that model.

The second is that for the layer we do provide, the carve-out written into the article is the one we rely on. It "shall not apply to the extent the AI systems perform an assistive function for standard editing or do not substantially alter the input data provided by the deployer or the semantics thereof." You supply the components, their descriptions and their schemas. This layer validates a model response against them and renders it. We read that as assistive rather than as generating a work of synthetic content.

Where that reading stops: if you use this SDK as the delivery surface for a general content generator, handing a model's free-form output to a user as content, our reading does not carry over to your app. Look at Article 50(2) for yourself in that case.

---

## Article 50(3): emotion recognition

We do not read Article 50(3) as engaged by anything this SDK does.

Article 3(39) defines an emotion recognition system as one inferring emotions or intentions **on the basis of biometric data**, and recital 18 confines that to biometric signals like face, gesture and voice. This SDK reads typed and tapped answers, and text is not biometric data. No camera, no microphone, no biometric processing anywhere in the render path.

If you add one, that is your system and your assessment, not this one.

---

## Article 25: the specification, and the open-source line

Article 25(2) closes with an express carve-out. The provider flip does not apply "in cases where the initial provider has clearly specified that its AI system is not to be changed into a high-risk AI system."

The sentence in bold under **Not for high-risk use** is that specification. It is written deliberately, and it is the reason this file exists in a repository rather than in a lawyer's drawer.

Article 25(4) ends with a sentence that matters for a project distributed like this one. The written-agreement duty "shall not apply to third parties making accessible to the public tools, services, processes, or components, other than general-purpose AI models, **under a free and open-source licence**." `wireai-rn` is MIT licensed, in a public repository, on a public registry. We read that sentence as covering it.

That carve-out removes a contracting duty. It does not remove the reason the duty exists.

There is no agreement to sign here because there is usually nobody to sign it with. The SDK is installed anonymously and we normally never learn who shipped it. So the information a deployer needs has to live in the repository instead, which is what this file is. If something you need to meet your own obligations is missing from it, open an issue. It gets added here, where the next person finds it too.

---

## What this file is not

Nobody has reviewed or audited this SDK against the regulation. This is not a statement that it meets a legal standard, and it is not a badge to put on a landing page.

It is what we think the regulation asks of a component like this one, what we did about it, and which parts sit on your side of the line rather than ours. Your app, your users, your assessment.

Questions or a disagreement with any reading above: [open an issue](https://github.com/chohra-med/wireai-rn/issues).
