package game

import (
	"testing"
)

func TestOwnEyes(t *testing.T) {
	b := FromDiagram([]string{".X...", "X.X..", ".X...", ".....", "....."})
	if !IsOwnEye(b, Point{X: 1, Y: 1}, Black) {
		t.Fatal("expected an eye")
	}
	falseEye := FromDiagram([]string{"OX...", "X.X..", ".XO..", ".....", "....."})
	if IsOwnEye(falseEye, Point{X: 1, Y: 1}, Black) {
		t.Fatal("expected a false eye")
	}
}
