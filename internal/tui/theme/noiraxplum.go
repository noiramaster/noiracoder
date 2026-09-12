package theme

import (
	"github.com/charmbracelet/lipgloss"
)

// NoiraxplumTheme implements the Theme interface with Noira/Noirax brand colors.
// Dark + Yellow identity, built on Catppuccin Mocha structure for WCAG AA contrast.
type NoiraxplumTheme struct {
	BaseTheme
}

// NewNoiraxplumTheme creates a new instance of the Noiraxplum theme.
func NewNoiraxplumTheme() *NoiraxplumTheme {
	// NoiraX palette — negro puro + amarillo/magenta (fiel a design-tokens.ts)
	// background #000000, foreground #e0e0e0, accent #f9e2af (amarillo), magenta #D63384, muted #666666, border #222222
	darkBg := "#000000"
	darkBgSecondary := "#111111"
	darkBgDarker := "#000000"
	darkText := "#e0e0e0"
	darkTextMuted := "#666666"
	darkTextEmphasized := "#f9e2af"
	darkPrimary := "#f9e2af"   // Yellow — Noira primary
	darkSecondary := "#D63384" // Magenta — Noira secondary
	darkAccent := "#f9e2af"    // Yellow accent
	darkRed := "#FF3B3B"       // Noira red
	darkOrange := "#f9e2af"
	darkGreen := "#f9e2af"
	darkCyan := "#D63384"
	darkYellow := "#f9e2af"
	darkBorder := "#222222"
	darkBorderDim := "#111111"

	// Light mode palette (Catppuccin Latte base)
	lightBg := "#eff1f5"
	lightBgSecondary := "#e6e9ef"
	lightBgDarker := "#dce0e8"
	lightText := "#4c4f69"
	lightTextMuted := "#7c7f93"
	lightTextEmphasized := "#df8e1d"
	lightPrimary := "#df8e1d"   // Darker goldenrod for light bg
	lightSecondary := "#8839ef" // Purple
	lightAccent := "#fe640b"    // Orange
	lightRed := "#d20f39"
	lightOrange := "#fe640b"
	lightGreen := "#40a02b"
	lightCyan := "#179299"
	lightYellow := "#df8e1d"
	lightBorder := "#bcc0cc"
	lightBorderDim := "#ccd0da"

	theme := &NoiraxplumTheme{}

	// Base colors
	theme.PrimaryColor = lipgloss.AdaptiveColor{Dark: darkPrimary, Light: lightPrimary}
	theme.SecondaryColor = lipgloss.AdaptiveColor{Dark: darkSecondary, Light: lightSecondary}
	theme.AccentColor = lipgloss.AdaptiveColor{Dark: darkAccent, Light: lightAccent}

	// Status colors
	theme.ErrorColor = lipgloss.AdaptiveColor{Dark: darkRed, Light: lightRed}
	theme.WarningColor = lipgloss.AdaptiveColor{Dark: darkOrange, Light: lightOrange}
	theme.SuccessColor = lipgloss.AdaptiveColor{Dark: darkGreen, Light: lightGreen}
	theme.InfoColor = lipgloss.AdaptiveColor{Dark: darkCyan, Light: lightCyan}

	// Text colors
	theme.TextColor = lipgloss.AdaptiveColor{Dark: darkText, Light: lightText}
	theme.TextMutedColor = lipgloss.AdaptiveColor{Dark: darkTextMuted, Light: lightTextMuted}
	theme.TextEmphasizedColor = lipgloss.AdaptiveColor{Dark: darkTextEmphasized, Light: lightTextEmphasized}

	// Background colors
	theme.BackgroundColor = lipgloss.AdaptiveColor{Dark: darkBg, Light: lightBg}
	theme.BackgroundSecondaryColor = lipgloss.AdaptiveColor{Dark: darkBgSecondary, Light: lightBgSecondary}
	theme.BackgroundDarkerColor = lipgloss.AdaptiveColor{Dark: darkBgDarker, Light: lightBgDarker}

	// Border colors
	theme.BorderNormalColor = lipgloss.AdaptiveColor{Dark: darkBorder, Light: lightBorder}
	theme.BorderFocusedColor = lipgloss.AdaptiveColor{Dark: darkPrimary, Light: lightPrimary}
	theme.BorderDimColor = lipgloss.AdaptiveColor{Dark: darkBorderDim, Light: lightBorderDim}

	// Diff view colors
	theme.DiffAddedColor = lipgloss.AdaptiveColor{Dark: "#a6e3a1", Light: "#40a02b"}
	theme.DiffRemovedColor = lipgloss.AdaptiveColor{Dark: "#f38ba8", Light: "#d20f39"}
	theme.DiffContextColor = lipgloss.AdaptiveColor{Dark: "#a6adc8", Light: "#7c7f93"}
	theme.DiffHunkHeaderColor = lipgloss.AdaptiveColor{Dark: "#a6adc8", Light: "#7c7f93"}
	theme.DiffHighlightAddedColor = lipgloss.AdaptiveColor{Dark: "#a6e3a1", Light: "#40a02b"}
	theme.DiffHighlightRemovedColor = lipgloss.AdaptiveColor{Dark: "#f38ba8", Light: "#d20f39"}
	theme.DiffAddedBgColor = lipgloss.AdaptiveColor{Dark: "#2a3a2a", Light: "#e6f2e6"}
	theme.DiffRemovedBgColor = lipgloss.AdaptiveColor{Dark: "#3a2a2a", Light: "#f2e6e6"}
	theme.DiffContextBgColor = lipgloss.AdaptiveColor{Dark: darkBg, Light: lightBg}
	theme.DiffLineNumberColor = lipgloss.AdaptiveColor{Dark: "#6c7086", Light: "#8c8fa1"}
	theme.DiffAddedLineNumberBgColor = lipgloss.AdaptiveColor{Dark: "#2a352a", Light: "#dff0df"}
	theme.DiffRemovedLineNumberBgColor = lipgloss.AdaptiveColor{Dark: "#352a2a", Light: "#f0dfdf"}

	// Markdown colors
	theme.MarkdownTextColor = lipgloss.AdaptiveColor{Dark: darkText, Light: lightText}
	theme.MarkdownHeadingColor = lipgloss.AdaptiveColor{Dark: darkPrimary, Light: lightPrimary}
	theme.MarkdownLinkColor = lipgloss.AdaptiveColor{Dark: darkSecondary, Light: lightSecondary}
	theme.MarkdownLinkTextColor = lipgloss.AdaptiveColor{Dark: darkCyan, Light: lightCyan}
	theme.MarkdownCodeColor = lipgloss.AdaptiveColor{Dark: darkGreen, Light: lightGreen}
	theme.MarkdownBlockQuoteColor = lipgloss.AdaptiveColor{Dark: darkYellow, Light: lightYellow}
	theme.MarkdownEmphColor = lipgloss.AdaptiveColor{Dark: darkYellow, Light: lightYellow}
	theme.MarkdownStrongColor = lipgloss.AdaptiveColor{Dark: darkPrimary, Light: lightPrimary}
	theme.MarkdownHorizontalRuleColor = lipgloss.AdaptiveColor{Dark: "#585b70", Light: "#bcc0cc"}
	theme.MarkdownListItemColor = lipgloss.AdaptiveColor{Dark: darkPrimary, Light: lightPrimary}
	theme.MarkdownListEnumerationColor = lipgloss.AdaptiveColor{Dark: darkCyan, Light: lightCyan}
	theme.MarkdownImageColor = lipgloss.AdaptiveColor{Dark: darkPrimary, Light: lightPrimary}
	theme.MarkdownImageTextColor = lipgloss.AdaptiveColor{Dark: darkCyan, Light: lightCyan}
	theme.MarkdownCodeBlockColor = lipgloss.AdaptiveColor{Dark: darkText, Light: lightText}

	// Syntax highlighting colors
	theme.SyntaxCommentColor = lipgloss.AdaptiveColor{Dark: "#6c7086", Light: "#8c8fa1"}
	theme.SyntaxKeywordColor = lipgloss.AdaptiveColor{Dark: darkPrimary, Light: lightPrimary}
	theme.SyntaxFunctionColor = lipgloss.AdaptiveColor{Dark: darkSecondary, Light: lightSecondary}
	theme.SyntaxVariableColor = lipgloss.AdaptiveColor{Dark: darkRed, Light: lightRed}
	theme.SyntaxStringColor = lipgloss.AdaptiveColor{Dark: darkGreen, Light: lightGreen}
	theme.SyntaxNumberColor = lipgloss.AdaptiveColor{Dark: darkAccent, Light: lightAccent}
	theme.SyntaxTypeColor = lipgloss.AdaptiveColor{Dark: darkYellow, Light: lightYellow}
	theme.SyntaxOperatorColor = lipgloss.AdaptiveColor{Dark: darkCyan, Light: lightCyan}
	theme.SyntaxPunctuationColor = lipgloss.AdaptiveColor{Dark: darkText, Light: lightText}

	return theme
}

func init() {
	RegisterTheme("noiraxplum", NewNoiraxplumTheme())
}
