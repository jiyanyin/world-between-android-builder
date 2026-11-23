# Android build runner

Manually dispatched Android builds on a standard Linux runner. This repository
contains only the runner workflow and its generic packaging scripts.

Dispatch with an authenticated encrypted input in a draft release. Upload only
the encrypted result. A build without the original signing certificate is an
internal compile check and must not be installed over an existing release.
