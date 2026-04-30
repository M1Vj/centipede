# Pull Request: Bug Fixes and Enhancements for Mathlete Flow & Registration

## Description

This PR addresses multiple critical bugs, transitions, and logic issues across the registration flow, competition management, and the Mathlete dashboard. It also includes UI refinements and fixes to ensure smoother user experiences for both organizers and Mathletes.

## Key Changes & Bug Fixes

### 🎨 UI & Dashboard Refinements
- **Mathletes Flow:** Refined and fixed UI arrangements within the Mathlete user flows.
- **Mathlete Dashboard:** Fixed state fetching and reflection issues for the Mathlete dashboard.

### 📝 Competition Management & Drafts
- **Draft Retention:** Fixed issues regarding competition draft content retention.
- **Published Competition Management:** Implemented/Fixed a dedicated management UI for published competitions, empowering organizers to easily view and manage participants.

### 👥 Registration Logistics & Syncing
- **Team Registration:** Resolved an ambiguous column error that was causing team registrations to fail.
- **Registration Constraints:** Fixed timing verification failures and implemented missing registration withdrawal functionalities.
- **Count & Visibility Sync:** Fixed registration count synchronizations and visibility, ensuring accurate numbers are displayed constraint-wide.
- **Registration Time Logic:** Corrected logic ensuring dates/times are accurately tracked.

### ⚙️ State Transitions
- **State Transition Failure:** Fixed an issue preventing automatic state transitions from firing correctly.

## Commits Included
* `f7c562f` fix: refine and fix some of the UI arrangement of the Mathletes flow
* `72565ed` fix: competition draft contents retention and registration time logic
* `ba1723d` feat/fix: Published Competition Management UI
* `710d723` fix: Team registration failure (ambiguous column)
* `9d10d72` fix: Automatic state transition failure
* `774405a` fix: Registration count sync & visibility
* `f7a9cd2` fix: Mathlete Dashboard state
* `f7bbbe9` fix: partially fix the Registration count sync & visibility
* `905258b` fix: Registration timing verification failure and Missing registration withdrawal

## Type of Change
- [x] Bug fix (non-breaking change which fixes an issue)
- [x] Enhancement (improves UI or adds functionality to existing features)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)

## Checklist
- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes